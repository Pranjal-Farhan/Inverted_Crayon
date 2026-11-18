"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { setCustomerSession, clearCustomerSession } from "@/lib/session";
import { STAND_IN_PASSWORD_HASH, TOO_MANY_LOGIN_ATTEMPTS, isLocked, lockoutMessage, nextLockoutState } from "@/lib/login-lockout";
import { RATE_LIMITED_MESSAGE, RATE_LIMITS, consumeRateLimit, consumeRateLimitForClient, resetRateLimit } from "@/lib/rate-limit";
import { notifyAccountRegistered, notifyLoginLockout } from "@/lib/notifications";

export async function customerLogin(
  _prev: { ok: boolean; error: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!(await consumeRateLimitForClient(RATE_LIMITS.customerLoginIp))) {
    return { ok: false, error: RATE_LIMITED_MESSAGE };
  }
  // Counted before the password is checked (see adminLogin): parallel guesses can't outrun the lockout.
  if (!(await consumeRateLimit(RATE_LIMITS.customerLoginAccount, email))) {
    return { ok: false, error: TOO_MANY_LOGIN_ATTEMPTS };
  }

  const customer = await db.customer.findUnique({ where: { email } });

  if (customer && isLocked(customer.lockedUntil)) {
    return { ok: false, error: lockoutMessage(customer.lockedUntil!) };
  }

  // One bcrypt comparison whatever happens (a stand-in hash for unknown emails and Google-only
  // accounts), so response time doesn't tell an attacker which emails are registered.
  const passwordOk = await bcrypt.compare(password, customer?.passwordHash ?? STAND_IN_PASSWORD_HASH);
  if (!customer || !customer.passwordHash || !passwordOk) {
    if (customer) {
      const next = nextLockoutState(customer.failedLoginCount);
      await db.customer.update({ where: { id: customer.id }, data: next });
      // This is the failed attempt that tripped the lock (it only becomes non-null at the limit).
      if (next.lockedUntil) {
        await notifyLoginLockout({ email: customer.email, role: "Customer", attempts: next.failedLoginCount, lockedUntil: next.lockedUntil });
      }
    }
    return { ok: false, error: "Invalid email or password." };
  }

  if (customer.failedLoginCount > 0) {
    await db.customer.update({ where: { id: customer.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }
  await resetRateLimit(RATE_LIMITS.customerLoginAccount, email);

  await setCustomerSession({ customerId: customer.id, email: customer.email, name: customer.name, avatarUrl: customer.avatarUrl });
  redirect("/account");
}

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(254),
  // The number we (or the courier) can reach them on.
  phone: z.string().trim().min(6).max(30),
  password: z.string().min(8).max(128),
});

export async function customerRegister(
  _prev: { ok: boolean; error: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string }> {
  if (!(await consumeRateLimitForClient(RATE_LIMITS.register))) {
    return { ok: false, error: RATE_LIMITED_MESSAGE };
  }
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "That didn't go through. Check the fields in red and try again." };
  }
  const email = parsed.data.email.toLowerCase();

  // Refuse to touch an account that already exists — every Customer row already has a way to
  // log in (a passwordHash from an earlier registration, or a googleId from OAuth),
  // so silently overwriting it here would let anyone take over any account just by knowing its
  // email address.
  const existing = await db.customer.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with that email already exists. Please log in instead." };
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const customer = await db.customer.create({ data: { email, passwordHash, name: parsed.data.name, phone: parsed.data.phone } });

  // Guest orders placed under this email are deliberately NOT attached to the new account: nothing
  // here proves the person registering owns the address, and those orders carry someone's name,
  // phone and home address. (A Google sign-up, whose address Google has verified, still claims them —
  // see the OAuth callback.) Guests keep finding their orders by number + email on /track.
  await notifyAccountRegistered({
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    method: "Email & password",
    claimedOrders: 0,
  });

  await setCustomerSession({ customerId: customer.id, email: customer.email, name: customer.name, avatarUrl: customer.avatarUrl });
  redirect("/account");
}

export async function customerLogout() {
  await clearCustomerSession();
  redirect("/account/login");
}
