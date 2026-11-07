import { describe, expect, it } from "vitest";
import { summarizeTransactions } from "@/server/finance/calc";
import { formatZMW, lineTotal, money, sum } from "@/lib/money";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("financial calculations (decimal-safe)", () => {
  it("avoids floating point errors", () => {
    expect(sum(["0.1", "0.2"]).toString()).toBe("0.3");
    expect(lineTotal("3", "0.1").toFixed(2)).toBe("0.30");
    expect(money("10.005").toFixed(2)).toBe("10.01");
  });

  it("computes income, expenses, gross and net profit", () => {
    const s = summarizeTransactions([
      { type: "EXPENSE", category: "FERTILIZER", amount: "21600.00", date: d("2026-01-02"), crop: "Maize", field: "A" },
      { type: "EXPENSE", category: "LABOUR", amount: "3000.10", date: d("2026-01-20"), crop: "Maize", field: "A" },
      { type: "EXPENSE", category: "SEEDS", amount: "4800.00", date: d("2026-01-12"), crop: "Soybeans", field: "B" },
      { type: "INCOME", category: "PRODUCE_SALE", amount: "51300.00", date: d("2026-05-18"), crop: "Maize" },
      { type: "INCOME", category: "OTHER_INCOME", amount: "3500.00", date: d("2026-07-10") },
    ]);
    expect(s.totalIncome).toBe("54800.00");
    expect(s.totalExpenses).toBe("29400.10");
    expect(s.netProfit).toBe("25399.90");
    // gross = produce sales − (seeds + fertilizer + chemicals + irrigation); labour excluded
    expect(s.grossProfit).toBe("24900.00");
    expect(s.profitByCrop.find((c) => c.name === "Maize")).toEqual({ name: "Maize", revenue: "51300.00", cost: "24600.10", profit: "26699.90" });
    expect(s.costByField.find((c) => c.name === "A")?.amount).toBe("24600.10");
    expect(s.monthly.map((m) => m.month)).toEqual(["2026-01", "2026-05", "2026-07"]);
    expect(s.monthly[0]).toMatchObject({ income: "0.00", expenses: "29400.10", net: "-29400.10" });
  });

  it("handles no transactions", () => {
    const s = summarizeTransactions([]);
    expect(s.netProfit).toBe("0.00");
    expect(s.transactionCount).toBe(0);
  });

  it("formats Kwacha", () => {
    expect(formatZMW("1234.5")).toMatch(/K\s?1,234\.50/);
    expect(formatZMW(null)).toBe("—");
  });
});
