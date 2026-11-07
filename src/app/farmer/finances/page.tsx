import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Download, Minus, Plus, Scale, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Table, THead, TBody, TR, TH, TD } from "@/components/ui/primitives";
import { DataLabel, PageHeader, StatCard } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/forms/form-dialog";
import { ActionButton } from "@/components/forms/action-form";
import { GroupedBars, RankedBars } from "@/components/charts/charts";
import { EstimateForm, TransactionForm } from "@/components/finance/forms";
import { PdfButton } from "@/components/finance/pdf-button";
import { requirePageRole } from "@/lib/auth/session";
import { formatZMW } from "@/lib/money";
import { TXN_CATEGORY_LABEL } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import { financialSummary, listEstimates, listTransactions } from "@/server/finance/service";
import { farmOptions } from "@/server/farms/options";
import { deleteEstimateAction, deleteTransactionAction } from "@/server/actions/ops";

export const metadata: Metadata = { title: "Finances" };

const catLabel = (c: string) => TXN_CATEGORY_LABEL[c as keyof typeof TXN_CATEGORY_LABEL] ?? c;

export default async function FinancesPage() {
  const user = await requirePageRole("FARMER");
  const actor = { id: user.id, role: user.role };
  const [s, txns, estimates, opts] = await Promise.all([financialSummary(user.id), listTransactions(actor, { take: 200 }), listEstimates(actor), farmOptions(user.id)]);
  const expenseCats = s.byCategory.filter((c) => !["PRODUCE_SALE", "OTHER_INCOME"].includes(c.name));
  const fertilizer = s.byCategory.find((c) => c.name === "FERTILIZER")?.amount ?? "0.00";
  const ask = encodeURIComponent("Explain my farm's financial performance. Which crop is most profitable and which expenses should I watch?");

  return (
    <>
      <PageHeader
        title="Farm finances"
        description="Income and expenses in Kwacha, calculated exactly from your recorded transactions. Completed marketplace sales and input purchases post automatically."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/farmer/assistant?q=${ask}`}>
                <Bot /> Ask Grok to explain
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href="/api/export/transactions">
                <Download /> CSV
              </a>
            </Button>
            <PdfButton
              filename="agriflow-financial-report"
              title="Farm financial report"
              subtitle={user.profile?.fullName ?? undefined}
              summary={[
                ["Total income", formatZMW(s.totalIncome)],
                ["Total expenses", formatZMW(s.totalExpenses)],
                ["Gross profit", formatZMW(s.grossProfit)],
                ["Net profit", formatZMW(s.netProfit)],
              ]}
              sections={[
                { title: "Expenses by category", head: ["Category", "Amount (ZMW)"], rows: expenseCats.map((c) => [catLabel(c.name), c.amount]) },
                { title: "Profit by crop", head: ["Crop", "Revenue", "Cost", "Profit"], rows: s.profitByCrop.map((c) => [c.name, c.revenue, c.cost, c.profit]) },
                { title: "Monthly", head: ["Month", "Income", "Expenses", "Net"], rows: s.monthly.map((m) => [m.month, m.income, m.expenses, m.net]) },
                { title: "Transactions (actual)", head: ["Date", "Type", "Category", "Amount", "Description"], rows: txns.map((t) => [t.date.toISOString().slice(0, 10), t.type, catLabel(t.category), t.amount.toFixed(2), t.description ?? ""]) },
              ]}
            />
            <FormDialog trigger={<><Plus /> Record transaction</>} title="Record income or expense" wide>
              <TransactionForm farms={opts} />
            </FormDialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total income" value={formatZMW(s.totalIncome)} icon={TrendingUp} />
        <StatCard label="Total expenses" value={formatZMW(s.totalExpenses)} icon={TrendingDown} tone="navy" />
        <StatCard label="Gross profit" value={formatZMW(s.grossProfit)} hint="Produce sales − direct inputs" icon={Scale} tone="sky" />
        <StatCard label="Net profit" value={formatZMW(s.netProfit)} hint="All income − all expenses" icon={Wallet} tone={Number(s.netProfit) >= 0 ? "forest" : "amber"} />
      </div>
      <p className="mt-2 flex items-center gap-2 text-xs text-navy-500">
        <DataLabel kind="ACTUAL" /> {s.transactionCount} recorded transactions · fertilizer spend to date {formatZMW(fertilizer)}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Monthly trend</CardTitle>
          </CardHeader>
          <CardContent>
            {s.monthly.length ? (
              <GroupedBars data={s.monthly.map((m) => ({ month: m.month, Income: Number(m.income), Expenses: Number(m.expenses) }))} xKey="month" series={[{ key: "Income", label: "Income" }, { key: "Expenses", label: "Expenses" }]} money />
            ) : (
              <p className="text-sm text-navy-500">No transactions yet.</p>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Expenses by category</CardTitle>
          </CardHeader>
          <CardContent>
            {expenseCats.length ? <RankedBars data={expenseCats.map((c) => ({ name: catLabel(c.name), amount: Number(c.amount) }))} labelKey="name" valueKey="amount" money color="#2563eb" /> : <p className="text-sm text-navy-500">No expenses yet.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profit by crop</CardTitle>
            <p className="text-xs text-navy-500">Only transactions linked to a crop are included.</p>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <THead>
                <tr>
                  <TH>Crop</TH>
                  <TH>Revenue</TH>
                  <TH>Cost</TH>
                  <TH>Profit</TH>
                </tr>
              </THead>
              <TBody>
                {s.profitByCrop.map((c) => (
                  <TR key={c.name}>
                    <TD className="font-medium">{c.name}</TD>
                    <TD>{formatZMW(c.revenue)}</TD>
                    <TD>{formatZMW(c.cost)}</TD>
                    <TD className={Number(c.profit) >= 0 ? "font-semibold text-forest-700" : "font-semibold text-red-600"}>{formatZMW(c.profit)}</TD>
                  </TR>
                ))}
                {!s.profitByCrop.length && (
                  <TR>
                    <TD colSpan={4} className="text-center text-navy-500">
                      Link transactions to crops to compare profitability.
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cost by field</CardTitle>
          </CardHeader>
          <CardContent>
            {s.costByField.length ? <RankedBars data={s.costByField.map((c) => ({ name: c.name, amount: Number(c.amount) }))} labelKey="name" valueKey="amount" money color="#d97706" /> : <p className="text-sm text-navy-500">Link expenses to fields to see where money goes.</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Budget estimates <DataLabel kind="ESTIMATE" />
            </CardTitle>
            <p className="text-xs text-navy-500">Planned figures, kept separate from actuals. Estimated profit: {formatZMW(s.estimates.profit)}</p>
          </div>
          <FormDialog trigger={<><Plus /> Add estimate</>} title="Add a budget estimate" size="sm" variant="secondary" wide>
            <EstimateForm farms={opts} />
          </FormDialog>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <THead>
              <tr>
                <TH>Season</TH>
                <TH>Type</TH>
                <TH>Category</TH>
                <TH>Crop</TH>
                <TH>Amount</TH>
                <TH>Assumptions</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {estimates.map((e) => (
                <TR key={e.id}>
                  <TD>{e.season}</TD>
                  <TD>
                    <Badge tone={e.type === "ESTIMATED_REVENUE" ? "green" : "amber"}>{e.type === "ESTIMATED_REVENUE" ? "Expected revenue" : "Planned cost"}</Badge>
                  </TD>
                  <TD>{catLabel(e.category)}</TD>
                  <TD>{e.cropRecord?.crop.name ?? "—"}</TD>
                  <TD className="font-medium">{formatZMW(e.amount)}</TD>
                  <TD className="text-xs">{e.description ?? ""}</TD>
                  <TD>
                    <ActionButton size="icon-sm" variant="ghost" aria-label="Delete estimate" action={async () => { "use server"; return deleteEstimateAction(e.id); }}>
                      <Trash2 />
                    </ActionButton>
                  </TD>
                </TR>
              ))}
              {!estimates.length && (
                <TR>
                  <TD colSpan={7} className="text-center text-navy-500">
                    No estimates yet.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Transactions <DataLabel kind="ACTUAL" />
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Category</TH>
                <TH>Farm / crop</TH>
                <TH>Description</TH>
                <TH className="text-right">Amount</TH>
                <TH />
              </tr>
            </THead>
            <TBody>
              {txns.map((t) => (
                <TR key={t.id}>
                  <TD className="whitespace-nowrap">{formatDate(t.date)}</TD>
                  <TD>{catLabel(t.category)}</TD>
                  <TD className="text-xs">
                    {t.farm?.name ?? "—"}
                    {t.cropRecord ? ` · ${t.cropRecord.crop.name}` : ""}
                  </TD>
                  <TD className="max-w-72 truncate text-xs">
                    {t.description}
                    {t.orderId && <Badge tone="blue" className="ml-1">from order</Badge>}
                  </TD>
                  <TD className={`whitespace-nowrap text-right font-semibold ${t.type === "INCOME" ? "text-forest-700" : "text-navy-800"}`}>
                    {t.type === "INCOME" ? <Plus className="inline size-3" /> : <Minus className="inline size-3" />} {formatZMW(t.amount)}
                  </TD>
                  <TD>
                    {!t.orderId && (
                      <ActionButton size="icon-sm" variant="ghost" aria-label="Delete transaction" confirm="Delete this transaction?" action={async () => { "use server"; return deleteTransactionAction(t.id); }}>
                        <Trash2 />
                      </ActionButton>
                    )}
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
