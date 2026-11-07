import "server-only";
import type { AICallStatus, AIContext, Prisma, ReportType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import type { Actor } from "@/lib/action";
import { AppError, forbidden, invalid, notFound } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { formatZMW } from "@/lib/money";
import { TXN_CATEGORY_LABEL } from "@/lib/labels";
import { getSetting } from "@/server/admin/settings";
import { notify } from "@/server/notifications/service";
import { financialSummary } from "@/server/finance/service";
import { createTask } from "@/server/farms/service";
import { adminAIContext } from "@/server/analytics/service";
import { uploadBytes } from "@/server/storage/service";
import { callGrok, GrokUnavailableError, type InputMessage } from "./xai";
import { buildFarmerContext } from "./context";
import { isFinanceQuestion, matchFallbackTopic } from "./fallback";
import {
  ADMIN_SYSTEM,
  advisorJsonSchema,
  advisorZ,
  chatAnswerZ,
  chatJsonSchema,
  CROP_ADVISOR_SYSTEM,
  CROP_HEALTH_SYSTEM,
  cropHealthJsonSchema,
  cropHealthZ,
  dataBlock,
  FARMER_CHAT_SYSTEM,
  REPORT_SYSTEM,
  sanitizeUserText,
  userBlock,
  type AdvisorResult,
  type ChatAnswer,
  type CropHealthResult,
} from "./prompts";

export type AIMode = "grok" | "fallback";

// ───────── guards & usage ─────────

async function guard(actor: Actor, feature: string) {
  const enabled = await getSetting<boolean>("ai.enabled", true);
  if (!enabled) throw new AppError("AI features are temporarily disabled by the administrator.", "UNAVAILABLE");
  const limit = await getSetting<number>("ai.hourlyLimitPerUser", env.aiHourlyLimit);
  await rateLimit(`ai:${actor.id}`, limit, 3600);
  void feature;
}

async function logUsage(userId: string, feature: string, status: AICallStatus, r?: { model?: string; inputTokens?: number | null; outputTokens?: number | null; latencyMs?: number }, error?: string) {
  await prisma.aIUsage.create({
    data: { userId, feature, status, model: r?.model, inputTokens: r?.inputTokens ?? null, outputTokens: r?.outputTokens ?? null, latencyMs: r?.latencyMs, error: error?.slice(0, 300) },
  });
}

function describeFailure(e: unknown) {
  if (e instanceof GrokUnavailableError) return e.reason === "NOT_CONFIGURED" ? "Grok is not configured (no XAI_API_KEY)." : `Grok is temporarily unavailable (${e.reason.toLowerCase()}).`;
  return "Grok is temporarily unavailable.";
}

// ───────── conversations ─────────

async function getOrCreateConversation(actor: Actor, context: AIContext, conversationId: string | undefined, firstMessage: string) {
  if (conversationId) {
    const conv = await prisma.aIConversation.findUnique({ where: { id: conversationId } });
    if (!conv || conv.userId !== actor.id || conv.context !== context) throw notFound("Conversation not found.");
    return conv;
  }
  return prisma.aIConversation.create({ data: { userId: actor.id, context, title: firstMessage.slice(0, 70) } });
}

async function historyFor(conversationId: string, take = 10): Promise<InputMessage[]> {
  const rows = await prisma.aIMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "desc" }, take });
  return rows.reverse().map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.role === "USER" ? userBlock(m.content) : m.content.slice(0, 4000) }));
}

export async function listConversations(actor: Actor, context: AIContext) {
  return prisma.aIConversation.findMany({ where: { userId: actor.id, context }, orderBy: { updatedAt: "desc" }, take: 30, include: { _count: { select: { messages: true } } } });
}

export async function getConversationMessages(actor: Actor, id: string) {
  const conv = await prisma.aIConversation.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!conv || conv.userId !== actor.id) throw notFound("Conversation not found.");
  return conv;
}

export async function deleteConversation(actor: Actor, id: string) {
  const res = await prisma.aIConversation.deleteMany({ where: { id, userId: actor.id } });
  if (!res.count) throw notFound();
}

// ───────── farmer assistant ─────────

export type ChatReply = { conversationId: string; messageId: string; mode: AIMode; answer: ChatAnswer; notice?: string };

export async function farmerChat(actor: Actor, input: { conversationId?: string; message: string }): Promise<ChatReply> {
  if (actor.role !== "FARMER") throw forbidden("The farm assistant is available to farmer accounts.");
  const message = sanitizeUserText(input.message);
  if (!message) throw invalid("Type a question.");
  await guard(actor, "farmer_chat");
  const conv = await getOrCreateConversation(actor, "FARMER_ASSISTANT", input.conversationId, message);
  const history = await historyFor(conv.id);
  await prisma.aIMessage.create({ data: { conversationId: conv.id, role: "USER", content: message } });
  const context = await buildFarmerContext(actor.id);

  let answer: ChatAnswer;
  let mode: AIMode = "grok";
  let notice: string | undefined;
  let meta: { model?: string; inputTokens?: number | null; outputTokens?: number | null; latencyMs?: number } = {};
  try {
    const r = await callGrok({
      input: [
        { role: "system", content: FARMER_CHAT_SYSTEM },
        { role: "system", content: `Farmer context from AgriFlow records:\n${dataBlock(context)}` },
        ...history,
        { role: "user", content: userBlock(message) },
      ],
      schema: chatJsonSchema as unknown as { name: string; schema: Record<string, unknown> },
      parse: (raw) => chatAnswerZ.parse(raw),
      maxOutputTokens: 1800,
    });
    answer = r.data;
    meta = r;
    await logUsage(actor.id, "farmer_chat", "OK", r);
  } catch (e) {
    mode = "fallback";
    notice = `${describeFailure(e)} Showing AgriFlow's built-in guidance instead.`;
    answer = fallbackChatAnswer(message, context.finances_actual_recorded_ZMW);
    await logUsage(actor.id, "farmer_chat", e instanceof GrokUnavailableError && e.reason === "NOT_CONFIGURED" ? "FALLBACK" : "ERROR", undefined, String(e));
  }

  const saved = await prisma.aIMessage.create({
    data: {
      conversationId: conv.id,
      role: "ASSISTANT",
      content: answer.answer,
      meta: { ...answer, mode, notice: notice ?? null } as unknown as Prisma.InputJsonValue,
      model: mode === "grok" ? meta.model : "agriflow-fallback",
      status: mode === "grok" ? "OK" : "FALLBACK",
      inputTokens: meta.inputTokens ?? null,
      outputTokens: meta.outputTokens ?? null,
      latencyMs: meta.latencyMs,
    },
  });
  await prisma.aIConversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } });
  return { conversationId: conv.id, messageId: saved.id, mode, answer, notice };
}

export function fallbackChatAnswer(question: string, fin?: { totalIncome: string; totalExpenses: string; netProfit: string; grossProfit: string; byCategory: { name: string; amount: string }[]; transactionCount: number }): ChatAnswer {
  if (fin && isFinanceQuestion(question)) {
    const top = fin.byCategory.filter((c) => !["PRODUCE_SALE", "OTHER_INCOME"].includes(c.name)).slice(0, 4);
    const body =
      fin.transactionCount === 0
        ? "You have not recorded any income or expenses yet. Open **Finances** to add your first transactions, and the figures will appear here."
        : `Here are your recorded figures (actual amounts from your Finances records):
- **Total income:** ${formatZMW(fin.totalIncome)}
- **Total expenses:** ${formatZMW(fin.totalExpenses)}
- **Gross profit** (produce sales minus seed, fertilizer, chemical and irrigation costs): ${formatZMW(fin.grossProfit)}
- **Net profit** (all income minus all expenses): ${formatZMW(fin.netProfit)}
${top.length ? `\nLargest cost categories:\n${top.map((c) => `- ${TXN_CATEGORY_LABEL[c.name as keyof typeof TXN_CATEGORY_LABEL] ?? c.name}: ${formatZMW(c.amount)}`).join("\n")}` : ""}

Open **Finances** for charts by crop, field and month.`;
    return { answer: body, clarifying_question: null, uncertainty_note: null, used_farm_data: fin.transactionCount > 0, suggested_tasks: [] };
  }
  const topic = matchFallbackTopic(question);
  if (topic) {
    return {
      answer: `### ${topic.title}\n\n${topic.body}`,
      clarifying_question: null,
      uncertainty_note: "This is general guidance from AgriFlow's built-in library, not a personalised AI answer. Confirm with your local extension officer.",
      used_farm_data: false,
      suggested_tasks: [],
    };
  }
  return {
    answer:
      "I can't reach the AI service right now, and I don't have built-in guidance for this exact question.\n\nYou can try again in a few minutes, or contact your camp extension officer. Built-in guidance covers maize planting, fall armyworm, yellowing leaves, maize diseases, soybeans, groundnuts, field preparation, storage and post-harvest losses, expenses, and weather.",
    clarifying_question: null,
    uncertainty_note: null,
    used_farm_data: false,
    suggested_tasks: [],
  };
}

/** Farmer explicitly confirms adding a task that the AI suggested. Validated against the stored suggestion. */
export async function addSuggestedTask(actor: Actor, messageId: string, index: number, farmId?: string) {
  const msg = await prisma.aIMessage.findUnique({ where: { id: messageId }, include: { conversation: true } });
  if (!msg || msg.conversation.userId !== actor.id || msg.role !== "ASSISTANT") throw notFound();
  const parsed = chatAnswerZ.safeParse(msg.meta);
  const suggestion = parsed.success ? parsed.data.suggested_tasks[index] : undefined;
  if (!suggestion) throw invalid("Suggestion not found.");
  const due = new Date();
  due.setUTCDate(due.getUTCDate() + suggestion.due_in_days);
  return createTask(actor, { title: suggestion.title, type: suggestion.activity_type, dueDate: due, farmId, reminder: true }, "AI_SUGGESTION");
}

// ───────── crop health ─────────

export async function assessCropHealth(actor: Actor, input: { cropId: string; farmId?: string; cropRecordId?: string; symptoms: string; imageId?: string }) {
  if (actor.role !== "FARMER") throw forbidden();
  const symptoms = sanitizeUserText(input.symptoms, 1500);
  if (symptoms.length < 5) throw invalid("Describe what you see on the crop.", { symptoms: ["Please describe the symptoms"] });
  const crop = await prisma.crop.findUnique({ where: { id: input.cropId } });
  if (!crop) throw invalid("Choose a crop.");
  if (input.farmId) {
    const farm = await prisma.farm.findUnique({ where: { id: input.farmId } });
    if (!farm || farm.ownerId !== actor.id) throw forbidden();
  }
  if (input.cropRecordId) {
    const rec = await prisma.cropRecord.findUnique({ where: { id: input.cropRecordId }, include: { farm: true } });
    if (!rec || rec.farm.ownerId !== actor.id) throw forbidden();
  }
  let image: { mimeType: string; bytes: Buffer } | null = null;
  if (input.imageId) {
    const up = await prisma.upload.findUnique({ where: { id: input.imageId } });
    if (!up || up.ownerId !== actor.id || up.kind !== "CROP_IMAGE") throw forbidden("Invalid image.");
    image = { mimeType: up.mimeType, bytes: await uploadBytes(up) };
  }
  await guard(actor, "crop_health");

  const assessment = await prisma.cropHealthAssessment.create({
    data: { userId: actor.id, cropId: crop.id, farmId: input.farmId, cropRecordId: input.cropRecordId, symptoms, imageId: input.imageId, status: "PENDING" },
  });

  const record = input.cropRecordId ? await prisma.cropRecord.findUnique({ where: { id: input.cropRecordId }, include: { farm: true } }) : null;
  const facts = {
    crop: crop.name,
    variety: record?.variety ?? null,
    growthStage: record?.growthStage ?? null,
    plantingDate: record?.plantingDate?.toISOString().slice(0, 10) ?? null,
    district: record?.farm.district ?? null,
    photoProvided: Boolean(image),
  };
  const content: InputMessage["content"] = [{ type: "input_text", text: `${dataBlock(facts)}\nFarmer's description:\n${userBlock(symptoms)}` }];
  if (image) content.push({ type: "input_image", image_url: `data:${image.mimeType};base64,${image.bytes.toString("base64")}`, detail: "high" });

  try {
    const r = await callGrok<CropHealthResult>({
      model: image ? env.xaiVisionModel : env.xaiModel,
      input: [
        { role: "system", content: CROP_HEALTH_SYSTEM },
        { role: "user", content },
      ],
      schema: cropHealthJsonSchema as unknown as { name: string; schema: Record<string, unknown> },
      parse: (raw) => cropHealthZ.parse(raw),
      maxOutputTokens: 1800,
    });
    // Guard against claims of having seen an image that was never sent
    const result = { ...r.data, image_assessed: Boolean(image) && r.data.image_assessed };
    await logUsage(actor.id, "crop_health", "OK", r);
    return prisma.cropHealthAssessment.update({
      where: { id: assessment.id },
      data: { status: "COMPLETED", possibleIssue: result.possible_issue, confidence: result.confidence, expertRecommended: result.expert_inspection_recommended, result: result as unknown as Prisma.InputJsonValue, model: r.model },
    });
  } catch (e) {
    await logUsage(actor.id, "crop_health", "ERROR", undefined, String(e));
    const topic = matchFallbackTopic(`${crop.name} ${symptoms}`);
    return prisma.cropHealthAssessment.update({
      where: { id: assessment.id },
      data: {
        status: "FAILED",
        expertRecommended: true,
        model: "agriflow-fallback",
        result: {
          error: `${describeFailure(e)} Your photo and description are saved. You can retry the analysis later.`,
          fallback: topic ? { title: topic.title, body: topic.body } : null,
        },
      },
    });
  }
}

export async function retryAssessment(actor: Actor, id: string) {
  const a = await prisma.cropHealthAssessment.findUnique({ where: { id } });
  if (!a || a.userId !== actor.id) throw notFound();
  if (a.status === "COMPLETED") throw invalid("This assessment is already complete.");
  await prisma.cropHealthAssessment.delete({ where: { id } });
  return assessCropHealth(actor, { cropId: a.cropId, farmId: a.farmId ?? undefined, cropRecordId: a.cropRecordId ?? undefined, symptoms: a.symptoms, imageId: a.imageId ?? undefined });
}

// ───────── crop advisor ─────────

export async function cropAdvice(actor: Actor, cropRecordId: string): Promise<{ mode: AIMode; advice: AdvisorResult | null; notice?: string }> {
  const rec = await prisma.cropRecord.findUnique({
    where: { id: cropRecordId },
    include: { crop: true, farm: true, field: true, activities: { orderBy: { date: "desc" }, take: 12 } },
  });
  if (!rec || rec.farm.ownerId !== actor.id) throw notFound("Crop record not found.");
  await guard(actor, "crop_advisor");
  const ctx = await buildFarmerContext(actor.id);
  const facts = {
    today: ctx.today,
    crop: rec.crop.name,
    variety: rec.variety,
    farm: { district: rec.farm.district, province: rec.farm.province, farmingType: rec.farm.farmingType },
    field: rec.field ? { name: rec.field.name, irrigation: rec.field.irrigation, soil: rec.field.soilType } : null,
    plantingDate: rec.plantingDate?.toISOString().slice(0, 10) ?? null,
    expectedHarvest: rec.expectedHarvestDate?.toISOString().slice(0, 10) ?? null,
    growthStage: rec.growthStage,
    status: rec.status,
    activities: rec.activities.map((a) => ({ date: a.date.toISOString().slice(0, 10), type: a.type, quantity: a.quantity?.toString() ?? null, unit: a.unit, notes: a.notes?.slice(0, 120) ?? null })),
    weather: Array.isArray(ctx.weather) ? ctx.weather.find((w) => w.farm === rec.farm.name) ?? "No cached weather for this farm" : ctx.weather,
  };
  try {
    const r = await callGrok<AdvisorResult>({
      input: [
        { role: "system", content: CROP_ADVISOR_SYSTEM },
        { role: "user", content: `${dataBlock(facts)}\nGive recommendations for this crop now.` },
      ],
      schema: advisorJsonSchema as unknown as { name: string; schema: Record<string, unknown> },
      parse: (raw) => advisorZ.parse(raw),
      maxOutputTokens: 1600,
    });
    await logUsage(actor.id, "crop_advisor", "OK", r);
    return { mode: "grok", advice: r.data };
  } catch (e) {
    await logUsage(actor.id, "crop_advisor", "ERROR", undefined, String(e));
    return { mode: "fallback", advice: null, notice: `${describeFailure(e)} Try again later, or ask the assistant a specific question.` };
  }
}

// ───────── reports ─────────

const REPORT_TITLE: Record<ReportType, string> = {
  WEEKLY_SUMMARY: "Weekly farm summary",
  MONTHLY_REPORT: "Monthly farming report",
  CROP_PERFORMANCE: "Crop performance report",
  EXPENSE_REPORT: "Expense report",
  HARVEST_REPORT: "Harvest report",
  PROFITABILITY: "Profitability summary",
  ADMIN_WEEKLY: "Weekly platform business report",
  ADMIN_MARKETPLACE: "Marketplace activity report",
};

function periodFor(type: ReportType) {
  const end = new Date();
  const start = new Date(end);
  if (type === "WEEKLY_SUMMARY" || type === "ADMIN_WEEKLY") start.setUTCDate(start.getUTCDate() - 7);
  else if (type === "MONTHLY_REPORT" || type === "ADMIN_MARKETPLACE") start.setUTCDate(start.getUTCDate() - 30);
  else start.setUTCFullYear(start.getUTCFullYear() - 1);
  return { start, end };
}

export async function computeFarmerReportData(userId: string, type: ReportType) {
  const { start, end } = periodFor(type);
  const [finance, activities, crops, tasksDone, orders] = await Promise.all([
    financialSummary(userId, { from: start, to: end }),
    prisma.farmActivity.groupBy({ by: ["type"], _count: true, _sum: { cost: true }, where: { userId, date: { gte: start, lte: end } } }),
    prisma.cropRecord.findMany({ where: { farm: { ownerId: userId } }, include: { crop: true, farm: { select: { name: true } } } }),
    prisma.farmTask.count({ where: { userId, status: "DONE", completedAt: { gte: start, lte: end } } }),
    prisma.purchaseOrder.groupBy({ by: ["status"], _count: true, where: { sellerId: userId, createdAt: { gte: start, lte: end } } }),
  ]);
  const cropRows = crops.map((c) => ({
    crop: c.crop.name,
    variety: c.variety,
    farm: c.farm.name,
    status: c.status,
    stage: c.growthStage,
    plantingDate: c.plantingDate?.toISOString().slice(0, 10) ?? null,
    estimatedYield: c.estimatedYield ? `${c.estimatedYield.toString()} ${c.yieldUnit}` : null,
    actualHarvest: c.actualHarvest ? `${c.actualHarvest.toString()} ${c.yieldUnit}` : null,
    yieldVsEstimatePct: c.estimatedYield && c.actualHarvest && Number(c.estimatedYield) > 0 ? Math.round((Number(c.actualHarvest) / Number(c.estimatedYield)) * 100) : null,
  }));
  const base = { period: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }, currency: "ZMW" };
  switch (type) {
    case "EXPENSE_REPORT":
      return { ...base, totalExpenses: finance.totalExpenses, byCategory: finance.byCategory.filter((c) => !["PRODUCE_SALE", "OTHER_INCOME"].includes(c.name)), costByCrop: finance.costByCrop, costByField: finance.costByField, monthly: finance.monthly };
    case "HARVEST_REPORT":
      return { ...base, harvested: cropRows.filter((c) => c.status === "HARVESTED"), upcoming: cropRows.filter((c) => c.status === "GROWING") };
    case "CROP_PERFORMANCE":
      return { ...base, crops: cropRows, profitByCrop: finance.profitByCrop };
    case "PROFITABILITY":
      return { ...base, totalIncome: finance.totalIncome, totalExpenses: finance.totalExpenses, grossProfit: finance.grossProfit, netProfit: finance.netProfit, profitByCrop: finance.profitByCrop, monthly: finance.monthly, estimates: finance.estimates };
    default:
      return {
        ...base,
        totalIncome: finance.totalIncome,
        totalExpenses: finance.totalExpenses,
        netProfit: finance.netProfit,
        activities: activities.map((a) => ({ type: a.type, count: a._count, costZMW: a._sum.cost?.toFixed(2) ?? "0.00" })),
        tasksCompleted: tasksDone,
        activeCrops: cropRows.filter((c) => c.status === "GROWING" || c.status === "PLANNED"),
        ordersReceived: orders.map((o) => ({ status: o.status, count: o._count })),
      };
  }
}

export async function generateFarmerReport(actor: Actor, type: ReportType) {
  if (actor.role !== "FARMER") throw forbidden();
  if (type === "ADMIN_WEEKLY" || type === "ADMIN_MARKETPLACE") throw forbidden();
  await guard(actor, "farmer_report");
  const data = await computeFarmerReportData(actor.id, type);
  return writeReport(actor, type, data, REPORT_SYSTEM, "farmer_report", "/farmer/reports");
}

export async function generateAdminReport(actor: Actor, type: "ADMIN_WEEKLY" | "ADMIN_MARKETPLACE") {
  if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") throw forbidden();
  await guard(actor, "admin_report");
  const data = await adminAIContext();
  return writeReport(actor, type, data as unknown as Record<string, unknown>, ADMIN_SYSTEM, "admin_report", "/admin/reports");
}

async function writeReport(actor: Actor, type: ReportType, data: Record<string, unknown>, system: string, feature: string, link: string) {
  const { start, end } = periodFor(type);
  let narrative: string;
  let status: AICallStatus = "OK";
  let model: string | undefined;
  try {
    const r = await callGrok<string>({
      input: [
        { role: "system", content: system },
        { role: "user", content: `${dataBlock(data)}\nWrite the "${REPORT_TITLE[type]}" for ${data.period ? JSON.stringify(data.period) : "the latest period"}. Use Markdown.` },
      ],
      maxOutputTokens: 1800,
    });
    narrative = r.data;
    model = r.model;
    await logUsage(actor.id, feature, "OK", r);
  } catch (e) {
    status = "FALLBACK";
    model = "agriflow-template";
    narrative = `> ${describeFailure(e)} This report contains the computed figures only, without an AI-written narrative.\n\n${templateNarrative(data)}`;
    await logUsage(actor.id, feature, "FALLBACK", undefined, String(e));
  }
  const report = await prisma.aIReport.create({
    data: { userId: actor.id, type, title: REPORT_TITLE[type], periodStart: start, periodEnd: end, data: data as Prisma.InputJsonValue, narrative, model, status },
  });
  await notify(actor.id, { type: "AI_REPORT", title: `${REPORT_TITLE[type]} ready`, body: "Your report has been generated.", link: `${link}/${report.id}` });
  return report;
}

function templateNarrative(data: Record<string, unknown>) {
  const lines: string[] = ["### Key figures"];
  for (const k of ["totalIncome", "totalExpenses", "grossProfit", "netProfit"]) {
    if (typeof data[k] === "string") lines.push(`- **${k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}:** ${formatZMW(data[k] as string)}`);
  }
  const totals = data.totals as Record<string, unknown> | undefined;
  if (totals) {
    lines.push(`- **Farmers:** ${totals.farmers}, **buyers:** ${totals.buyers}, **suppliers:** ${totals.suppliers}, **transporters:** ${totals.transporters}`);
    lines.push(`- **Farms:** ${totals.farms} (${totals.registeredHectares} ha)`);
    lines.push(`- **Active listings:** ${totals.activeListings}; **active orders:** ${totals.activeOrders}; **completed orders:** ${totals.completedOrders}`);
    lines.push(`- **Completed sales value:** ${formatZMW(String(totals.completedSalesValue))}`);
  }
  lines.push("", "See the tables below for the full breakdown.");
  return lines.join("\n");
}

export async function getReport(actor: Actor, id: string) {
  const r = await prisma.aIReport.findUnique({ where: { id } });
  if (!r || (r.userId !== actor.id && !((actor.role === "ADMIN" || actor.role === "SUPER_ADMIN") && r.type.startsWith("ADMIN")))) throw notFound();
  return r;
}

// ───────── admin business intelligence ─────────

export async function adminChat(actor: Actor, input: { conversationId?: string; message: string }) {
  if (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN") throw forbidden();
  const message = sanitizeUserText(input.message);
  if (!message) throw invalid("Type a question.");
  await guard(actor, "admin_chat");
  const conv = await getOrCreateConversation(actor, "ADMIN_INTELLIGENCE", input.conversationId, message);
  const history = await historyFor(conv.id, 6);
  await prisma.aIMessage.create({ data: { conversationId: conv.id, role: "USER", content: message } });
  const data = await adminAIContext();
  let content: string;
  let mode: AIMode = "grok";
  let notice: string | undefined;
  let r: Awaited<ReturnType<typeof callGrok<string>>> | undefined;
  try {
    r = await callGrok<string>({
      input: [{ role: "system", content: ADMIN_SYSTEM }, { role: "system", content: `Platform statistics:\n${dataBlock(data)}` }, ...history, { role: "user", content: userBlock(message) }],
      maxOutputTokens: 1600,
    });
    content = r.data;
    await logUsage(actor.id, "admin_chat", "OK", r);
  } catch (e) {
    mode = "fallback";
    notice = `${describeFailure(e)} Showing the computed statistics without AI commentary.`;
    content = templateNarrative(data as unknown as Record<string, unknown>);
    await logUsage(actor.id, "admin_chat", "FALLBACK", undefined, String(e));
  }
  const saved = await prisma.aIMessage.create({
    data: {
      conversationId: conv.id,
      role: "ASSISTANT",
      content,
      meta: { mode, notice: notice ?? null },
      model: r?.model ?? "agriflow-template",
      status: mode === "grok" ? "OK" : "FALLBACK",
      inputTokens: r?.inputTokens ?? null,
      outputTokens: r?.outputTokens ?? null,
      latencyMs: r?.latencyMs,
    },
  });
  await prisma.aIConversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } });
  return { conversationId: conv.id, messageId: saved.id, mode, content, notice };
}
