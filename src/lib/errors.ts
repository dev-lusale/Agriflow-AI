export class AppError extends Error {
  constructor(
    message: string,
    public code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "RATE_LIMITED" | "UNAVAILABLE" = "VALIDATION",
    public fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const forbidden = (msg = "You do not have permission to do this.") => new AppError(msg, "FORBIDDEN");
export const notFound = (msg = "Not found.") => new AppError(msg, "NOT_FOUND");
export const invalid = (msg: string, fieldErrors?: Record<string, string[] | undefined>) => new AppError(msg, "VALIDATION", fieldErrors);
export const conflict = (msg: string) => new AppError(msg, "CONFLICT");

export type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; code?: AppError["code"]; fieldErrors?: Record<string, string[] | undefined> };

export const httpStatus: Record<AppError["code"], number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UNAVAILABLE: 503,
};
