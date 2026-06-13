import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ACCESS_COOKIE } from "@/lib/constants";

const publicRoutes = ["/login", "/forgot-password", "/reset-password"];
const publicApiRoutes = ["/api/health", "/api/auth/csrf"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ACCESS_COOKIE)?.value;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (publicApiRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  if (
    publicRoutes.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/public")
  ) {
    return NextResponse.next();
  }

  if (!token && (pathname.startsWith("/dashboard") || pathname.startsWith("/api"))) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = await readRoleFromToken(token);

  if (!role) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/dashboard/coe") && role !== "COE")
    return redirectAccessDenied(request, "COE");
  if (pathname.startsWith("/dashboard/coordinator") && role !== "COORDINATOR")
    return redirectAccessDenied(request, "COORDINATOR");
  if (pathname.startsWith("/dashboard/moderator") && role !== "MODERATOR")
    return redirectAccessDenied(request, "MODERATOR");
  if (pathname.startsWith("/dashboard/contributor") && role !== "CONTRIBUTOR")
    return redirectAccessDenied(request, "CONTRIBUTOR");
  if (pathname.startsWith("/dashboard/dean") && role !== "DEAN")
    return redirectAccessDenied(request, "DEAN");

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};

async function readRoleFromToken(token?: string): Promise<string | undefined> {
  if (!token) return undefined;

  try {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload.role as string | undefined;
  } catch {
    return undefined;
  }
}

function redirectAccessDenied(request: NextRequest, deniedRole: string) {
  const url = new URL("/dashboard", request.url);
  url.searchParams.set("denied", deniedRole);
  return NextResponse.redirect(url);
}
