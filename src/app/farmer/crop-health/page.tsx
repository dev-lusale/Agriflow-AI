import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, HeartPulse, RotateCcw, ShieldAlert, Stethoscope } from "lucide-react";
import { Alert, Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { PageHeader } from "@/components/layout/page";
import { ActionButton } from "@/components/forms/action-form";
import { CropHealthForm } from "@/components/ai/crop-health-form";
import { Markdown } from "@/components/ai/markdown";
import { requirePageRole } from "@/lib/auth/session";
import { isAIConfigured } from "@/lib/env";
import { prisma } from "@/lib/db";
import { formatDateTime, cn } from "@/lib/utils";
import { cropCatalog, farmOptions } from "@/server/farms/options";
import { retryAssessmentAction } from "@/server/actions/ai";
import type { CropHealthResult } from "@/server/ai/prompts";

export const metadata: Metadata = { title: "Crop health" };

const confTone = { LOW: "red", MEDIUM: "amber", HIGH: "green" } as const;

export default async function CropHealthPage({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const sp = await searchParams;
  const user = await requirePageRole("FARMER");
  const [crops, farms, history] = await Promise.all([
    cropCatalog(),
    farmOptions(user.id),
    prisma.cropHealthAssessment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30, include: { crop: true, farm: { select: { name: true } } } }),
  ]);
  const selected = sp.a ? history.find((h) => h.id === sp.a) ?? null : null;
  if (sp.a && !selected) notFound();

  return (
    <>
      <PageHeader title="Crop health" description="Upload a photo and describe the symptoms. Grok gives an AI-assisted assessment: possible issues, confidence and next steps. It is not a definitive diagnosis." />
      {!isAIConfigured() && (
        <Alert tone="amber" className="mb-4" title="Grok vision is not configured">
          Assessments will be saved with your photo, and you can re-run them once XAI_API_KEY is set. Built-in guidance is shown in the meantime.
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HeartPulse className="size-4 text-forest-600" /> New assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CropHealthForm crops={crops} farms={farms} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Assessment history</CardTitle>
              <p className="text-xs text-navy-500">Compare observations over time.</p>
            </CardHeader>
            <CardContent className="px-2">
              {history.length === 0 ? (
                <p className="px-3 text-sm text-navy-500">No assessments yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {history.map((h) => (
                    <li key={h.id}>
                      <Link href={`/farmer/crop-health?a=${h.id}`} className={cn("flex items-start justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-navy-50", h.id === selected?.id && "bg-forest-50")}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{h.possibleIssue ?? (h.status === "FAILED" ? "Analysis not completed" : "Pending")}</p>
                          <p className="text-xs text-navy-500">
                            {h.crop.name}
                            {h.farm ? ` · ${h.farm.name}` : ""} · {formatDateTime(h.createdAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {h.isDemo && <Badge tone="amber">Demo</Badge>}
                          {h.confidence && <Badge tone={confTone[h.confidence]}>{h.confidence.toLowerCase()}</Badge>}
                          {h.status === "FAILED" && <Badge tone="red">Retry</Badge>}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          {selected ? (
            <AssessmentView a={selected} />
          ) : (
            <Card className="flex h-full min-h-64 flex-col items-center justify-center p-8 text-center">
              <Stethoscope className="size-10 text-forest-300" />
              <p className="mt-3 font-semibold">Your assessment will appear here</p>
              <p className="mt-1 max-w-sm text-sm text-navy-500">Results include the likely issue, visible symptoms, possible causes ranked by likelihood, next steps, prevention, and whether an expert should inspect.</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function AssessmentView({ a }: { a: Awaited<ReturnType<typeof prisma.cropHealthAssessment.findMany>>[number] & { crop: { name: string } } }) {
  const r = a.result as (CropHealthResult & { error?: string; fallback?: { title: string; body: string } | null }) | null;
  return (
    <Card>
      {a.imageId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/uploads/${a.imageId}`} alt="Submitted crop" className="max-h-72 w-full rounded-t-2xl object-cover" />
      )}
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-navy-500">{a.crop.name} · {formatDateTime(a.createdAt)}</p>
            <h2 className="mt-1 text-xl font-bold">{a.possibleIssue ?? "Analysis not completed"}</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {a.isDemo && <Badge tone="amber">Demo sample, not AI-generated</Badge>}
            {a.confidence && <Badge tone={confTone[a.confidence]}>Confidence: {a.confidence.toLowerCase()}</Badge>}
          </div>
        </div>
        <div className="rounded-xl bg-navy-50 p-3 text-sm">
          <p className="text-xs font-semibold text-navy-500">Your description</p>
          <p className="mt-1 text-navy-700">{a.symptoms}</p>
        </div>

        {a.status === "FAILED" && (
          <>
            <Alert tone="amber" icon={<AlertTriangle />} title="AI analysis unavailable">
              {r?.error ?? "The analysis could not be completed."}
            </Alert>
            <ActionButton variant="outline" action={async () => { "use server"; return retryAssessmentAction(a.id); }}>
              <RotateCcw /> Retry analysis
            </ActionButton>
            {r?.fallback && (
              <div className="rounded-xl border border-border p-4">
                <Badge tone="slate">Built-in guidance (not AI)</Badge>
                <div className="mt-2">
                  <Markdown text={`### ${r.fallback.title}\n\n${r.fallback.body}`} />
                </div>
              </div>
            )}
          </>
        )}

        {a.status === "COMPLETED" && r && !r.error && (
          <>
            {a.expertRecommended ? (
              <Alert tone="red" icon={<ShieldAlert />} title="Expert inspection recommended">
                Contact your camp extension officer or an agronomist to confirm before treating, especially if the problem is spreading.
              </Alert>
            ) : (
              <Alert tone="green" icon={<CheckCircle2 />} title="Expert inspection not required now">
                Keep monitoring. Ask an expert if symptoms spread or do not improve.
              </Alert>
            )}
            <Section title="Confidence">{r.confidence_explanation}</Section>
            {r.visible_symptoms?.length > 0 && <ListSection title={r.image_assessed ? "Visible symptoms (from photo and description)" : "Reported symptoms"} items={r.visible_symptoms} />}
            {r.possible_causes?.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold">Possible causes</p>
                <ul className="space-y-2">
                  {r.possible_causes.map((c, i) => (
                    <li key={i} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{c.name}</span>
                        <Badge tone={confTone[c.likelihood]}>{c.likelihood.toLowerCase()}</Badge>
                      </div>
                      <p className="mt-1 text-navy-600">{c.why}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ListSection title="Suggested next steps" items={r.next_steps ?? []} ordered />
            <ListSection title="Prevention" items={r.prevention ?? []} />
            {r.safety_note && (
              <p className="rounded-xl bg-harvest-50 px-3 py-2 text-xs text-harvest-800">
                <strong>Safety:</strong> {r.safety_note}
              </p>
            )}
            <p className="border-t border-border pt-3 text-xs text-navy-500">
              {a.isDemo ? "Demonstration sample." : `AI-assisted assessment by ${a.model ?? "Grok"}.`} Not a definitive diagnosis. Use only products registered for this crop in Zambia, and follow the label.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm text-navy-700">{children}</p>
    </div>
  );
}

function ListSection({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  if (!items.length) return null;
  const L = ordered ? "ol" : "ul";
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <L className={cn("mt-1 space-y-1 pl-5 text-sm text-navy-700", ordered ? "list-decimal" : "list-disc")}>
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </L>
    </div>
  );
}
