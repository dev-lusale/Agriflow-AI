import { Prisma, type TransactionCategory, type TransactionType } from "@prisma/client";

export type TxnLike = {
  type: TransactionType;
  category: TransactionCategory;
  amount: Prisma.Decimal | string | number;
  date: Date;
  crop?: string | null;
  field?: string | null;
};

const Z = () => new Prisma.Decimal(0);

/**
 * Decimal-safe profitability calculation.
 * Gross profit = produce-sale revenue − direct crop costs (seeds, fertilizer, chemicals, irrigation).
 * Net profit = all income − all expenses.
 */
export function summarizeTransactions(txns: TxnLike[]) {
  const DIRECT: TransactionCategory[] = ["SEEDS", "FERTILIZER", "CHEMICALS", "IRRIGATION"];
  let income = Z();
  let expenses = Z();
  let produceRevenue = Z();
  let directCosts = Z();
  const byCategory = new Map<TransactionCategory, Prisma.Decimal>();
  const costByCrop = new Map<string, Prisma.Decimal>();
  const revenueByCrop = new Map<string, Prisma.Decimal>();
  const costByField = new Map<string, Prisma.Decimal>();
  const monthly = new Map<string, { income: Prisma.Decimal; expenses: Prisma.Decimal }>();

  for (const t of txns) {
    const amt = new Prisma.Decimal(t.amount);
    const month = t.date.toISOString().slice(0, 7);
    const m = monthly.get(month) ?? { income: Z(), expenses: Z() };
    byCategory.set(t.category, (byCategory.get(t.category) ?? Z()).plus(amt));
    if (t.type === "INCOME") {
      income = income.plus(amt);
      m.income = m.income.plus(amt);
      if (t.category === "PRODUCE_SALE") produceRevenue = produceRevenue.plus(amt);
      if (t.crop) revenueByCrop.set(t.crop, (revenueByCrop.get(t.crop) ?? Z()).plus(amt));
    } else {
      expenses = expenses.plus(amt);
      m.expenses = m.expenses.plus(amt);
      if (DIRECT.includes(t.category)) directCosts = directCosts.plus(amt);
      if (t.crop) costByCrop.set(t.crop, (costByCrop.get(t.crop) ?? Z()).plus(amt));
      if (t.field) costByField.set(t.field, (costByField.get(t.field) ?? Z()).plus(amt));
    }
    monthly.set(month, m);
  }

  const toList = (m: Map<string, Prisma.Decimal>) =>
    [...m.entries()].map(([name, v]) => ({ name, amount: v.toFixed(2) })).sort((a, b) => Number(b.amount) - Number(a.amount));

  const crops = new Set([...costByCrop.keys(), ...revenueByCrop.keys()]);
  const profitByCrop = [...crops]
    .map((name) => {
      const rev = revenueByCrop.get(name) ?? Z();
      const cost = costByCrop.get(name) ?? Z();
      return { name, revenue: rev.toFixed(2), cost: cost.toFixed(2), profit: rev.minus(cost).toFixed(2) };
    })
    .sort((a, b) => Number(b.profit) - Number(a.profit));

  return {
    currency: "ZMW",
    totalIncome: income.toFixed(2),
    totalExpenses: expenses.toFixed(2),
    grossProfit: produceRevenue.minus(directCosts).toFixed(2),
    netProfit: income.minus(expenses).toFixed(2),
    produceRevenue: produceRevenue.toFixed(2),
    directCosts: directCosts.toFixed(2),
    byCategory: toList(byCategory as Map<string, Prisma.Decimal>),
    costByCrop: toList(costByCrop),
    revenueByCrop: toList(revenueByCrop),
    costByField: toList(costByField),
    profitByCrop,
    monthly: [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, income: v.income.toFixed(2), expenses: v.expenses.toFixed(2), net: v.income.minus(v.expenses).toFixed(2) })),
    transactionCount: txns.length,
  };
}

export type FinancialSummary = ReturnType<typeof summarizeTransactions>;
