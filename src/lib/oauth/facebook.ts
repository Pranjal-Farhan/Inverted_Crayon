import "server-only";

/**
 * Facebook Login (Authorization Code flow, plain fetch). Needs a Facebook app
 * (FACEBOOK_CLIENT_ID/FACEBOOK_CLIENT_SECRET) with a valid OAuth redirect URI of
 * `<your-site>/api/auth/facebook/callback`. When unset, `facebookConfigured()` is false and the
 * "Continue with Facebook" buttons bounce back with a clear message instead of erroring.
 */
export function facebookConfigured(): boolean {
  return Boolean(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET);
}

export function facebookAuthUrl(params: { redirectUri: string; state: string }): string {
  const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  url.searchParams.set("client_id", process.env.FACEBOOK_CLIENT_ID!);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", "email public_profile");
  return url.toString();
}

export async function facebookExchangeCode(params: {
  code: string;
  redirectUri: string;
}): Promise<{ id: string; email: string; name: string | null }> {
  const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
  tokenUrl.searchParams.set("client_id", process.env.FACEBOOK_CLIENT_ID!);
  tokenUrl.searchParams.set("client_secret", process.env.FACEBOOK_CLIENT_SECRET!);
  tokenUrl.searchParams.set("redirect_uri", params.redirectUri);
  tokenUrl.searchParams.set("code", params.code);
  const tokenRes = await fetch(tokenUrl);
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Facebook token exchange failed: ${JSON.stringify(tokenData)}`);
  }

  const userUrl = new URL("https://graph.facebook.com/me");
  userUrl.searchParams.set("fields", "id,name,email");
  userUrl.searchParams.set("access_token", tokenData.access_token);
  const userRes = await fetch(userUrl);
  const user = await userRes.json();
  if (!userRes.ok || !user.id) {
    throw new Error(`Facebook userinfo failed: ${JSON.stringify(user)}`);
  }
  if (!user.email) {
    throw new Error("Facebook account has no email on file — can't sign in with it.");
  }
  return { id: user.id, email: user.email, name: user.name ?? null };
}
