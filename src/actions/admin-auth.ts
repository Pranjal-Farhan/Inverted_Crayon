"use server";

import { homeFor } from "@/lib/admin-areas";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  setAdminSession,
  clearAdminSession,
  setAdmin2FAPending,
  getAdmin2FAPending,
  clearAdmin2FAPending,
} from "@/lib/session";
import { STAND_IN_PASSWORD_HASH, TOO_MANY_LOGIN_ATTEMPTS, isLocked, lockoutMessage, nextLockoutState } from "@/lib/login-lockout";
import { RATE_LIMITED_MESSAGE, RATE_LIMITS, consumeRateLimit, consumeRateLimitForClient, resetRateLimit } from "@/lib/rate-limit";
import { notifyLoginLockout } from "@/lib/notifications";
import { consumeSecondFactor } from "@/lib/two-factor";

export async function adminLogin(
  _prev: { ok: boolean; error: string; needsTwoFactor: boolean } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string; needsTwoFactor: boolean }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!(await consumeRateLimitForClient(RATE_LIMITS.adminLoginIp))) {
    return { ok: false, error: RATE_LIMITED_MESSAGE, needsTwoFactor: false };
  }
  // Counted before the password is checked, atomically, and for unknown emails too: the lockout below
  // is read-then-write, so without this a burst of parallel guesses would all get checked before it
  // kicks in. Given back on a successful login.
  if (!(await consumeRateLimit(RATE_LIMITS.adminLoginAccount, email))) {
    return { ok: false, error: TOO_MANY_LOGIN_ATTEMPTS, needsTwoFactor: false };
  }

  const user = await db.adminUser.findUnique({ where: { email } });

  if (user && isLocked(user.lockedUntil)) {
    return { ok: false, error: lockoutMessage(user.lockedUntil!), needsTwoFactor: false };
  }

  // Always pays for one bcrypt comparison — against a stand-in hash when there's no account or no
  // password on it — so an unknown email isn't answered measurably faster than a wrong password.
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? STAND_IN_PASSWORD_HASH);
  if (!user || !user.passwordHash || !passwordOk) {
    if (user) {
      const next = nextLockoutState(user.failedLoginCount);
      await db.adminUser.update({ where: { id: user.id }, data: next });
      if (next.lockedUntil) {
        await notifyLoginLockout({
          email: user.email,
          role: user.role === "ADMIN" ? "Admin" : "Staff",
          attempts: next.failedLoginCount,
          lockedUntil: next.lockedUntil,
        });
      }
    }
    return { ok: false, error: "Invalid email or password.", needsTwoFactor: false };
  }

  if (user.twoFactorEnabled) {
    // A correct password is only half a login here, so the failed-attempt counter is deliberately
    // NOT reset yet — it resets when the code step succeeds. Otherwise someone who knows the password
    // could alternate "log in, try four codes, log in again…" and guess the 6-digit code without limit.
    await setAdmin2FAPending({ adminId: user.id });
    return { ok: true, error: "", needsTwoFactor: true };
  }

  if (user.failedLoginCount > 0) {
    await db.adminUser.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }
  await resetRateLimit(RATE_LIMITS.adminLoginAccount, email);

  await setAdminSession({ adminId: user.id, email: user.email, name: user.name, role: user.role });
  redirect(homeFor(user.role));
}

/**
 * Second step of login when the account has 2FA enabled — accepts either a live TOTP code or an
 * unused backup code. Reuses the same failed-attempt lockout as the password step so a stolen
 * password alone can't be brute-forced against the 6-digit code.
 */
export async function verifyAdminTwoFactor(
  _prev: { ok: boolean; error: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string }> {
  if (!(await consumeRateLimitForClient(RATE_LIMITS.adminLoginIp))) {
    return { ok: false, error: RATE_LIMITED_MESSAGE };
  }
  const pending = await getAdmin2FAPending();
  if (!pending) {
    return { ok: false, error: "Your login attempt expired. Please log in again." };
  }

  const user = await db.adminUser.findUnique({ where: { id: pending.adminId } });
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    await clearAdmin2FAPending();
    return { ok: false, error: "Your login attempt expired. Please log in again." };
  }

  // The same per-account budget as the password step, so parallel code guesses all count too.
  if (!(await consumeRateLimit(RATE_LIMITS.adminLoginAccount, user.email))) {
    return { ok: false, error: TOO_MANY_LOGIN_ATTEMPTS };
  }

  if (isLocked(user.lockedUntil)) {
    return { ok: false, error: lockoutMessage(user.lockedUntil!) };
  }

  const code = String(formData.get("code") ?? "");

  if (await consumeSecondFactor(user, code)) {
    await db.adminUser.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    await resetRateLimit(RATE_LIMITS.adminLoginAccount, user.email);
    await clearAdmin2FAPending();
    await setAdminSession({ adminId: user.id, email: user.email, name: user.name, role: user.role });
    redirect(homeFor(user.role));
  }

  const next = nextLockoutState(user.failedLoginCount);
  await db.adminUser.update({ where: { id: user.id }, data: next });
  if (next.lockedUntil) {
    await notifyLoginLockout({
      email: user.email,
      role: user.role === "ADMIN" ? "Admin" : "Staff",
      attempts: next.failedLoginCount,
      lockedUntil: next.lockedUntil,
    });
    return { ok: false, error: lockoutMessage(next.lockedUntil) };
  }
  return { ok: false, error: "Invalid code." };
}

export async function adminLogout() {
  await clearAdminSession();
  await clearAdmin2FAPending();
  redirect("/admin/login");
}
