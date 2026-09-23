import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getSiteOrigin } from "@/lib/site-url";
import { googleConfigured, googleAuthUrl } from "@/lib/oauth/google";
import { facebookConfigured, facebookAuthUrl } from "@/lib/oauth/facebook";

const STATE_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600,
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const intent = req.nextUrl.searchParams.get("intent") === "admin" ? "admin" : "customer";
  const origin = await getSiteOrigin();
  const loginPath = intent === "admin" ? "/admin/login" : "/account/login";
  const redirectUri = `${origin}/api/auth/${provider}/callback`;
  const state = randomUUID();

  let authUrl: string;
  if (provider === "google") {
    if (!googleConfigured()) return NextResponse.redirect(`${origin}${loginPath}?oauth=not_configured`);
    authUrl = googleAuthUrl({ redirectUri, state });
  } else if (provider === "facebook") {
    if (!facebookConfigured()) return NextResponse.redirect(`${origin}${loginPath}?oauth=not_configured`);
    authUrl = facebookAuthUrl({ redirectUri, state });
  } else {
    return NextResponse.redirect(`${origin}${loginPath}?oauth=error`);
  }

  const res = NextResponse.redirect(authUrl);
  res.cookies.set("oauth_state", state, STATE_COOKIE_OPTS);
  res.cookies.set("oauth_intent", intent, STATE_COOKIE_OPTS);
  return res;
}
