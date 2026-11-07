import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { farmOptions } from "@/server/farms/options";

/** Minimal farm/field/crop names for offline forms (owner-scoped, never cached by intermediaries). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (user.role !== "FARMER") return NextResponse.json({ farms: [] });
  return NextResponse.json({ farms: await farmOptions(user.id), userId: user.id }, { headers: { "Cache-Control": "private, no-store" } });
}
