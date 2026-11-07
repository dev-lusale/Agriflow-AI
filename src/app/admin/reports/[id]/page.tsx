import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page";
import { ReportView } from "@/components/reports/report-view";
import { requirePageRole } from "@/lib/auth/session";
import { getReport } from "@/server/ai/service";

export const metadata: Metadata = { title: "Report" };

export default async function AdminReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePageRole("ADMIN", "SUPER_ADMIN");
  const report = await getReport({ id: user.id, role: user.role }, id).catch(() => null);
  if (!report) notFound();
  return (
    <>
      <PageHeader back={{ href: "/admin/reports", label: "Reports" }} title={report.title} />
      <ReportView report={report} />
    </>
  );
}
