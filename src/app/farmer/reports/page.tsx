import type { Metadata } from "next";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { EmptyState, PageHeader } from "@/components/layout/page";
import { GenerateReportForm } from "@/components/reports/generate-form";
import { requirePageRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { generateReportAction } from "@/server/actions/ai";

export const metadata: Metadata = { title: "Farm reports" };

const OPTIONS = [
  { value: "WEEKLY_SUMMARY", label: "Weekly farm summary" },
  { value: "MONTHLY_REPORT", label: "Monthly farming report" },
  { value: "CROP_PERFORMANCE", label: "Crop performance report" },
  { value: "EXPENSE_REPORT", label: "Expense report" },
  { value: "HARVEST_REPORT", label: "Harvest report" },
  { value: "PROFITABILITY", label: "Profitability summary" },
];

export default async function ReportsPage() {
  const user = await requirePageRole("FARMER");
  const reports = await prisma.aIReport.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });
  return (
    <>
      <PageHeader title="AI farm reports" description="AgriFlow computes the figures from your records, and Grok explains them in plain language. Export any report to PDF." />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generate a report</CardTitle>
        </CardHeader>
        <CardContent>
          <GenerateReportForm action={generateReportAction} options={OPTIONS} basePath="/farmer/reports" />
        </CardContent>
      </Card>
      {reports.length === 0 ? (
        <EmptyState icon={FileText} title="No reports yet" description="Generate your first weekly summary above." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <Link key={r.id} href={`/farmer/reports/${r.id}`}>
              <Card className="p-4 transition hover:shadow-[var(--shadow-lift)]">
                <div className="flex items-start justify-between gap-2">
                  <FileText className="size-5 text-forest-600" />
                  <Badge tone={r.status === "OK" ? "green" : "amber"}>{r.status === "OK" ? "AI narrative" : "Figures only"}</Badge>
                </div>
                <p className="mt-3 font-semibold">{r.title}</p>
                <p className="text-xs text-navy-500">{formatDateTime(r.createdAt)}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
