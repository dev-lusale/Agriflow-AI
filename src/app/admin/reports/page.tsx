import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { EmptyState, PageHeader } from "@/components/layout/page";
import { GenerateReportForm } from "@/components/reports/generate-form";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { generateAdminReportAction } from "@/server/actions/ai";

export const metadata: Metadata = { title: "Reports" };

export default async function AdminReportsPage() {
  await requirePageRole("ADMIN", "SUPER_ADMIN");
  const reports = await prisma.aIReport.findMany({ where: { type: { in: ["ADMIN_WEEKLY", "ADMIN_MARKETPLACE"] } }, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { profile: { select: { fullName: true } } } } } });
  return (
    <>
      <PageHeader title="Platform reports" description="Weekly business and marketplace reports: computed platform statistics with a Grok-written executive summary. Export to PDF." />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generate</CardTitle>
        </CardHeader>
        <CardContent>
          <GenerateReportForm action={generateAdminReportAction} basePath="/admin/reports" options={[{ value: "ADMIN_WEEKLY", label: "Weekly platform business report" }, { value: "ADMIN_MARKETPLACE", label: "Marketplace activity report (30 days)" }]} />
        </CardContent>
      </Card>
      {reports.length === 0 ? (
        <EmptyState icon={FileText} title="No reports yet" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <Link key={r.id} href={`/admin/reports/${r.id}`}>
              <Card className="p-4 transition hover:shadow-[var(--shadow-lift)]">
                <div className="flex justify-between">
                  <FileText className="size-5 text-forest-600" />
                  <Badge tone={r.status === "OK" ? "green" : "amber"}>{r.status === "OK" ? "AI summary" : "Figures only"}</Badge>
                </div>
                <p className="mt-3 font-semibold">{r.title}</p>
                <p className="text-xs text-navy-500">
                  {formatDateTime(r.createdAt)} · {r.user.profile?.fullName}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
