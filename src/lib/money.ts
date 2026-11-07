import { Prisma } from "@prisma/client";

/** Decimal-safe money helpers. All arithmetic uses Prisma.Decimal (decimal.js), never JS floats. */
export const D = (v: Prisma.Decimal.Value | null | undefined) => new Prisma.Decimal(v ?? 0);

export function sum(values: Array<Prisma.Decimal.Value | null | undefined>) {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(D(v)), new Prisma.Decimal(0));
}

/** Round to 2dp using banker-safe half-up (ROUND_HALF_UP). */
export function money(v: Prisma.Decimal.Value) {
  return D(v).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function lineTotal(quantity: Prisma.Decimal.Value, unitPrice: Prisma.Decimal.Value) {
  return money(D(quantity).times(D(unitPrice)));
}

export function formatZMW(v: Prisma.Decimal.Value | null | undefined, opts: { compact?: boolean } = {}) {
  if (v === null || v === undefined) return "—";
  const n = Number(D(v).toFixed(2));
  return new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    currencyDisplay: "code",
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.compact ? 1 : 2,
    minimumFractionDigits: opts.compact ? 0 : 2,
  })
    .format(n)
    .replace("ZMW", "K")
    .replace(/\s+/, " ");
}

/** Serialize Decimal to string for client components. */
export const dec = (v: Prisma.Decimal | null | undefined) => (v === null || v === undefined ? null : v.toString());
