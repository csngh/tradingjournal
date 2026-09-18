import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_TOKEN } from "@/lib/session";

/**
 * Gates every real page behind the session cookie set by the /unlock flow. This runs before any
 * page or layout renders, so protected pages' data-fetching never executes for an unauthenticated
 * request — the real trade/account data is never sent to the browser while locked, not just
 * hidden client-side.
 */
export function proxy(request: NextRequest) {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookie === SESSION_TOKEN) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!unlock|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo.png).*)",
  ],
};
