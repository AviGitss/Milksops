import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Demo gate: the visitor identifies themselves once on /login (which captures
 * the lead), and carries a signed-in cookie afterwards. Replace with Supabase
 * Auth + role-based policies before the plant pilot.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/login" ||
    pathname === "/favicon.ico" ||
    pathname === "/opennetrikkan.png"
  ) {
    return NextResponse.next();
  }
  if (!req.cookies.get("dairyops_user")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
