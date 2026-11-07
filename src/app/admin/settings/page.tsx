import type { Metadata } from "next";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { KeyValue, PageHeader } from "@/components/layout/page";
import { SettingRow } from "@/components/admin/setting-row";
import { requirePageRole } from "@/lib/auth/session";
import { env, isAIConfigured } from "@/lib/env";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { allSettings } from "@/server/admin/settings";

export const metadata: Metadata = { title: "System settings" };

const LABEL: Record<string, string> = {
  "marketplace.requireApproval": "Require admin approval before listings are visible",
  "ai.enabled": "AI features enabled",
  "ai.hourlyLimitPerUser": "AI requests per user per hour",
  "platform.supportEmail": "Support email",
  "platform.maintenanceBanner": "Maintenance banner text",
};

export default async function SettingsPage() {
  const user = await requirePageRole("ADMIN", "SUPER_ADMIN");
  const [settings, outbox] = await Promise.all([allSettings(), prisma.outboundMessage.findMany({ orderBy: { createdAt: "desc" }, take: 15 })]);
  return (
    <>
      <PageHeader title="System settings" description="Platform-wide configuration. Every change is recorded in the audit log." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Platform settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings.map((s) => (
              <SettingRow key={s.key} k={s.key} label={LABEL[s.key] ?? s.key} value={s.value as string | number | boolean} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <p className="text-xs text-navy-500">Status from server environment variables. Secrets are never displayed.</p>
          </CardHeader>
          <CardContent>
            <KeyValue
              className="sm:grid-cols-1"
              items={[
                ["xAI Grok", isAIConfigured() ? <Badge key="a" tone="green">Configured · {env.xaiModel}</Badge> : <Badge key="a" tone="amber">Not configured (fallback mode)</Badge>],
                ["Vision model", env.xaiVisionModel],
                ["Weather provider", <Badge key="w" tone="green">{env.weatherProvider}</Badge>],
                ["File storage", env.supabaseUrl && env.supabaseServiceKey ? <Badge key="s" tone="green">Supabase Storage</Badge> : <Badge key="s">PostgreSQL (built-in)</Badge>],
                ["Email", env.resendApiKey ? <Badge key="e" tone="green">Resend</Badge> : <Badge key="e" tone="amber">Not configured</Badge>],
                ["SMS / WhatsApp", <Badge key="m" tone="amber">Architecture ready, provider not connected</Badge>],
                ["Demo mode", env.demoMode ? <Badge key="d" tone="amber">On</Badge> : <Badge key="d">Off</Badge>],
                ["Your role", user.role === "SUPER_ADMIN" ? "Super administrator" : "Administrator"],
              ]}
            />
          </CardContent>
        </Card>
      </div>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Outbound message log</CardTitle>
          <p className="text-xs text-navy-500">Email/SMS/WhatsApp attempts. &quot;Not configured&quot; means no message was sent.</p>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Channel</TH>
                <TH>Recipient</TH>
                <TH>Subject</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {outbox.map((m) => (
                <TR key={m.id}>
                  <TD className="text-xs">{formatDateTime(m.createdAt)}</TD>
                  <TD>{m.channel}</TD>
                  <TD className="text-xs">{m.recipient.replace(/(.{3}).+(@.+)/, "$1…$2")}</TD>
                  <TD className="max-w-64 truncate text-xs">{m.subject ?? m.body.slice(0, 60)}</TD>
                  <TD>
                    <Badge tone={m.status === "SENT" ? "green" : m.status === "FAILED" ? "red" : "amber"}>{m.status.toLowerCase().replace("_", " ")}</Badge>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
