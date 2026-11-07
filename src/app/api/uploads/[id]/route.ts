import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { AppError, httpStatus } from "@/lib/errors";
import { readUpload } from "@/server/storage/service";

/** Serves uploaded images after an authorisation check. Private files are never publicly cacheable. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const user = await getCurrentUser();
    const { upload, bytes } = await readUpload(user ? { id: user.id, role: user.role } : null, id);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": upload.mimeType,
        "Content-Length": String(bytes.length),
        "Cache-Control": upload.isPublic ? "public, max-age=86400" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      },
    });
  } catch (e) {
    const status = e instanceof AppError ? httpStatus[e.code] : 500;
    return NextResponse.json({ error: e instanceof AppError ? e.message : "Server error" }, { status });
  }
}
