import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Email adapter. Sends through Resend when RESEND_API_KEY is configured.
 * Otherwise the message is stored with status NOT_CONFIGURED — we never claim it was sent.
 */
export async function sendEmail(input: { to: string; subject: string; text: string; userId?: string }) {
  const record = await prisma.outboundMessage.create({
    data: { userId: input.userId, channel: "EMAIL", recipient: input.to, subject: input.subject, body: input.text, status: "QUEUED" },
  });
  if (!env.resendApiKey) {
    await prisma.outboundMessage.update({ where: { id: record.id }, data: { status: "NOT_CONFIGURED", provider: null } });
    if (!env.isProduction) console.info(`[email:not-configured] to=${input.to} subject="${input.subject}"\n${input.text}`);
    return { sent: false as const, reason: "NOT_CONFIGURED" as const };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFrom, to: [input.to], subject: input.subject, text: input.text }),
    });
    if (!res.ok) throw new Error(`Resend HTTP ${res.status}`);
    await prisma.outboundMessage.update({ where: { id: record.id }, data: { status: "SENT", provider: "resend", sentAt: new Date() } });
    return { sent: true as const };
  } catch (e) {
    await prisma.outboundMessage.update({
      where: { id: record.id },
      data: { status: "FAILED", provider: "resend", error: String(e).slice(0, 300) },
    });
    return { sent: false as const, reason: "FAILED" as const };
  }
}
