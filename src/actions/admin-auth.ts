"use server";

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
import { isLocked, lockoutMessage, nextLockoutState } from "@/lib/login-lockout";
import { verifyTotpCode } from "@/lib/totp";

export async function adminLogin(
  _prev: { ok: boolean; error: string; needsTwoFactor: boolean } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string; needsTwoFactor: boolean }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await db.adminUser.findUnique({ where: { email } });

  if (user && isLocked(user.lockedUntil)) {
    return { ok: false, error: lockoutMessage(user.lockedUntil!), needsTwoFactor: false };
  }

  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    if (user) {
      const next = nextLockoutState(user.failedLoginCount);
      await db.adminUser.update({ where: { id: user.id }, data: next });
    }
    return { ok: false, error: "Invalid email or password.", needsTwoFactor: false };
  }

  if (user.failedLoginCount > 0) {
    await db.adminUser.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }

  if (user.twoFactorEnabled) {
    await setAdmin2FAPending({ adminId: user.id });
    return { ok: true, error: "", needsTwoFactor: true };
  }

  await setAdminSession({ adminId: user.id, email: user.email, name: user.name, role: user.role });
  redirect("/admin/dashboard");
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
  const pending = await getAdmin2FAPending();
  if (!pending) {
    return { ok: false, error: "Your login attempt expired. Please log in again." };
  }

  const user = await db.adminUser.findUnique({ where: { id: pending.adminId } });
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    await clearAdmin2FAPending();
    return { ok: false, error: "Your login attempt expired. Please log in again." };
  }

  if (isLocked(user.lockedUntil)) {
    return { ok: false, error: lockoutMessage(user.lockedUntil!) };
  }

  const code = String(formData.get("code") ?? "").trim();

  if (verifyTotpCode(user.twoFactorSecret, code)) {
    if (user.failedLoginCount > 0) {
      await db.adminUser.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    }
    await clearAdmin2FAPending();
    await setAdminSession({ adminId: user.id, email: user.email, name: user.name, role: user.role });
    redirect("/admin/dashboard");
  }

  // Not a valid TOTP code — check it against the stored (bcrypt-hashed) backup codes instead.
  const normalizedInput = code.toUpperCase();
  for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
    if (await bcrypt.compare(normalizedInput, user.twoFactorBackupCodes[i])) {
      const remaining = [...user.twoFactorBackupCodes];
      remaining.splice(i, 1);
      await db.adminUser.update({
        where: { id: user.id },
        data: { twoFactorBackupCodes: remaining, failedLoginCount: 0, lockedUntil: null },
      });
      await clearAdmin2FAPending();
      await setAdminSession({ adminId: user.id, email: user.email, name: user.name, role: user.role });
      redirect("/admin/dashboard");
    }
  }

  const next = nextLockoutState(user.failedLoginCount);
  await db.adminUser.update({ where: { id: user.id }, data: next });
  return { ok: false, error: "Invalid code." };
}

export async function adminLogout() {
  await clearAdminSession();
  await clearAdmin2FAPending();
  redirect("/admin/login");
}
