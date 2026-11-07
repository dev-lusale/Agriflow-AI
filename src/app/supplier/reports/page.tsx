import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { PageHeader, StatCard } from "@/components/layout/page";
import { GroupedBars, RankedBars } from "@/components/charts/charts";
import { PdfButton } from "@/components/finance/pdf-button";
import { requirePageRole } from "@/lib/auth/session";
import { formatZMW } from "@/lib/money";
import { supplierSales } from "@/server/suppliers/service";

export const metadata: Metadata = { title: "Sales reports" };

export default async function SupplierReportsPage() {
  const user = await requirePageRole("SUPPLIER");
  const s = await supplierSales({ id: user.id, role: user.role });
  return (
    <>
      <PageHeader
        title="Sales reports"
        description="Completed input sales on AgriFlow, computed from your orders."
        actions={
          <>
            <Button asChild variant="outline">
              <a href="/api/export/orders">
                <Download /> CSV
              </a>
            </Button>
            <PdfButton
              filename="agriflow-supplier-sales"
              title="Supplier sales report"
              summary={[
                ["Completed revenue", formatZMW(s.revenue)],
                ["Completed orders", String(s.completed)],
                ["Open orders", String(s.pending)],
              ]}
              sections={[
                { title: "Sales by product", head: ["Product", "Revenue (ZMW)"], rows: s.byProduct.map((p) => [p.name, p.total.toFixed(2)]) },
                { title: "Sales by month", head: ["Month", "Revenue (ZMW)"], rows: s.monthly.map((m) => [m.month, m.total.toFixed(2)]) },
              ]}
            />
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Completed revenue" value={formatZMW(s.revenue)} />
        <StatCard label="Completed orders" value={s.completed} />
        <StatCard label="Open orders" value={s.pending} tone="sky" />
        <StatCard label="All orders" value={s.orders} tone="navy" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by month</CardTitle>
          </CardHeader>
          <CardContent>{s.monthly.length ? <GroupedBars data={s.monthly} xKey="month" series={[{ key: "total", label: "Revenue" }]} money /> : <p className="text-sm text-navy-500">No completed sales yet.</p>}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue by product</CardTitle>
          </CardHeader>
          <CardContent>{s.byProduct.length ? <RankedBars data={s.byProduct} labelKey="name" valueKey="total" money /> : <p className="text-sm text-navy-500">No completed sales yet.</p>}</CardContent>
        </Card>
      </div>
    </>
  );
}
