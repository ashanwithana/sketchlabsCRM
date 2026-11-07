import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getEnv } from "@/lib/env";

// First line of defence: verifies the session token signature before any page renders.
// Pages and server actions still call requireUser(), which also checks the user exists.
const SESSION_COOKIE = "cma_session";
// /approve/<token> is for clients. The token is its only credential, checked by the page itself.
// /api/cron/* authenticates itself with the CRON_SECRET bearer token inside the route.
const PUBLIC_PATHS = ["/login", "/approve", "/api/cron"];

async function hasValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(getEnv().SESSION_SECRET);
    await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const signedIn = await hasValidSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!isPublic && !signedIn) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    const response = NextResponse.redirect(url);
    response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (pathname === "/login" && signedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();
  // SAMEORIGIN lets the app embed its own PDF preview while still blocking clickjacking from other sites.
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'self'");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
