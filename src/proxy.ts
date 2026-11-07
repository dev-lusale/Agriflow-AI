import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight pre-check only: unauthenticated visitors to protected areas are redirected to login.
 * Real authentication + role authorisation happens server-side in layouts, server actions and route handlers.
 */
const PROTECTED = ["/farmer", "/buyer", "/supplier", "/transporter", "/admin", "/onboarding", "/messages", "/notifications", "/deliveries"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (needsAuth && !req.cookies.get("af_session")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|sw.js|manifest.webmanifest|icons|brand|apple-touch-icon.png|apple-icon.png|opengraph-image.png).*)"],
};
