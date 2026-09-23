import { NextResponse, type NextRequest } from "next/server";

/**
 * Baseline security headers for every response — this app had none (no CSP, no clickjacking
 * protection, no MIME-sniffing guard). Kept minimal/safe rather than a strict CSP, since a
 * misconfigured CSP silently breaks pages rather than failing loudly.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (request.nextUrl.protocol === "https:") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
