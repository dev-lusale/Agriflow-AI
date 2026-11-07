import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";

/**
 * Fixed-window rate limiter stored in Postgres (works across serverless instances).
 * Returns remaining requests; throws RATE_LIMITED when exceeded.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const windowStartCutoff = new Date(now.getTime() - windowSeconds * 1000);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart") VALUES (${key}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" < ${windowStartCutoff} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < ${windowStartCutoff} THEN ${now} ELSE "RateLimit"."windowStart" END
    RETURNING "count"`;
  const count = Number(rows[0]?.count ?? 1);
  if (count > limit) {
    throw new AppError(`Too many requests. Please wait a little and try again.`, "RATE_LIMITED");
  }
  return limit - count;
}
