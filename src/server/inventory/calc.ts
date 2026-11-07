import { Prisma } from "@prisma/client";
import { AppError } from "@/lib/errors";

/** Pure stock arithmetic (unit-tested). */
export function applyMovement(current: Prisma.Decimal, direction: "IN" | "OUT" | "ADJUST", qty: Prisma.Decimal, allowNegative = false) {
  if (qty.lte(0)) throw new AppError("Quantity must be greater than zero.", "VALIDATION");
  let change: Prisma.Decimal;
  if (direction === "IN") change = qty;
  else if (direction === "OUT") change = qty.negated();
  else change = qty.minus(current); // ADJUST sets the counted stock level
  const balance = current.plus(change);
  if (balance.lt(0) && !allowNegative) {
    throw new AppError(`Not enough stock: ${current.toString()} available.`, "VALIDATION", { quantity: ["Would make stock negative"] });
  }
  return { change, balance };
}
