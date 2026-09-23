import "server-only";

/**
 * Google OAuth (Authorization Code flow, no SDK — plain fetch). Needs a Google Cloud OAuth client
 * (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET); its authorized redirect URI must be
 * `<your-site>/api/auth/google/callback`. When unset, `googleConfigured()` is false and the
 * "Continue with Google" buttons bounce back with a clear message instead of erroring.
 */
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthUrl(params: { redirectUri: string; state: string }): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  return url.toString();
}

export async function googleExchangeCode(params: {
  code: string;
  redirectUri: string;
}): Promise<{ id: string; email: string; name: string | null }> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      code: params.code,
      grant_type: "authorization_code",
      redirect_uri: params.redirectUri,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Google token exchange failed: ${JSON.stringify(tokenData)}`);
  }

  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const user = await userRes.json();
  if (!userRes.ok || !user.sub || !user.email) {
    throw new Error(`Google userinfo failed: ${JSON.stringify(user)}`);
  }
  return { id: user.sub, email: user.email, name: user.name ?? null };
}
