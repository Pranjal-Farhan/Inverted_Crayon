import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSiteOrigin } from "@/lib/site-url";
import { db } from "@/lib/db";
import { setCustomerSession, setAdminSession } from "@/lib/session";
import { googleExchangeCode } from "@/lib/oauth/google";
import { facebookExchangeCode } from "@/lib/oauth/facebook";

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: rawProvider } = await params;
  const origin = await getSiteOrigin();
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  const store = await cookies();
  const expectedState = store.get("oauth_state")?.value;
  const intent = store.get("oauth_intent")?.value === "admin" ? "admin" : "customer";
  store.delete("oauth_state");
  store.delete("oauth_intent");

  const loginPath = intent === "admin" ? "/admin/login" : "/account/login";

  if (rawProvider !== "google" && rawProvider !== "facebook") {
    return NextResponse.redirect(`${origin}${loginPath}?oauth=error`);
  }
  const provider = rawProvider;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${origin}${loginPath}?oauth=error`);
  }

  try {
    const redirectUri = `${origin}/api/auth/${provider}/callback`;
    const profile =
      provider === "google" ? await googleExchangeCode({ code, redirectUri }) : await facebookExchangeCode({ code, redirectUri });
    const email = profile.email.toLowerCase();

    if (intent === "admin") {
      // Admin/staff OAuth only ever signs in to an account that already exists (matched first by
      // provider id, then by email) — it never self-registers a new admin account. That would be
      // a privilege-escalation path: anyone with a Google/Facebook account could otherwise grant
      // themselves store-admin access just by hitting this callback.
      let account =
        provider === "google"
          ? await db.adminUser.findFirst({ where: { googleId: profile.id } })
          : await db.adminUser.findFirst({ where: { facebookId: profile.id } });

      if (!account) {
        account = await db.adminUser.findUnique({ where: { email } });
        if (!account) {
          return NextResponse.redirect(`${origin}${loginPath}?oauth=no_account`);
        }
        account =
          provider === "google"
            ? await db.adminUser.update({ where: { id: account.id }, data: { googleId: profile.id } })
            : await db.adminUser.update({ where: { id: account.id }, data: { facebookId: profile.id } });
      }

      await setAdminSession({ adminId: account.id, email: account.email, name: account.name, role: account.role });
      return NextResponse.redirect(`${origin}/admin/dashboard`);
    }

    let customer =
      provider === "google"
        ? await db.customer.findFirst({ where: { googleId: profile.id } })
        : await db.customer.findFirst({ where: { facebookId: profile.id } });

    if (!customer) {
      const existing = await db.customer.findUnique({ where: { email } });
      if (existing) {
        customer =
          provider === "google"
            ? await db.customer.update({ where: { id: existing.id }, data: { googleId: profile.id } })
            : await db.customer.update({ where: { id: existing.id }, data: { facebookId: profile.id } });
      } else {
        customer = await db.customer.create({
          data: {
            email,
            name: profile.name,
            googleId: provider === "google" ? profile.id : undefined,
            facebookId: provider === "facebook" ? profile.id : undefined,
          },
        });
        // Guest orders placed under this email before signing up get claimed, same as password registration.
        await db.order.updateMany({ where: { email, customerId: null }, data: { customerId: customer.id } });
      }
    }

    await setCustomerSession({ customerId: customer.id, email: customer.email, name: customer.name });
    return NextResponse.redirect(`${origin}/account`);
  } catch (e) {
    console.error("OAuth callback failed", e);
    return NextResponse.redirect(`${origin}${loginPath}?oauth=error`);
  }
}
