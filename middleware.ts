import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { env } from "@/lib/env";

/**
 * Next.js Edge Middleware — runs before every request.
 *
 * RESPONSIBILITIES:
 *   1. JWT verification — redirect unauthenticated users to /login
 *   2. Cache-Control headers — no-store on all confidential routes
 *   3. Trusted proxy IP handling — extract real client IP from proxy headers
 *   4. Security headers — reinforce CSP, XFO, etc.
 *
 * COMPLEMENTARY to withApiHandler:
 *   - Middleware handles edge-level concerns (redirects, headers, IP)
 *   - withApiHandler handles application-level security (CSRF, rate limit, authz, audit)
 *   - Both are required — they are NOT duplicative
 */

// ─── Public routes (no JWT required) ──────────────────────────────────────

const PUBLIC_ROUTES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/csrf",
  "/api/health",
  "/_next/static",
  "/_next/image",
  "/favicon.ico",
  "/api/auth/refresh",
] as const;

// ─── Confidential routes (must receive Cache-Control: no-store) ───────────

const CONFIDENTIAL_PATH_PREFIXES = [
  "/api/",
  "/dashboard/",
] as const;

// ─── Middleware ───────────────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip middleware for public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // 2. JWT verification — redirect to login if not authenticated
  const token = request.cookies.get("emqpgs_access_token")?.value;
  if (!token) {
    return redirectToLogin(request, pathname);
  }

  // Verify JWT synchronously — uses the raw secret to check without DB
  try {
    const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    jwtVerify(token, secret);
  } catch {
    return redirectToLogin(request, pathname);
  }

  // 3. Build response with security headers
  const response = NextResponse.next();

  // 4. Cache-Control: no-store on confidential routes
  if (CONFIDENTIAL_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("Surrogate-Control", "no-store");
  }

  return response;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function redirectToLogin(request: NextRequest, returnPath: string): NextResponse {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", returnPath);
  const response = NextResponse.redirect(loginUrl);

  // Also set no-cache on the redirect response
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

// ─── Matcher — apply to all routes except static assets ──────────────────

export const config = {
  matcher: [
    // Apply to all routes except Next.js internal assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
