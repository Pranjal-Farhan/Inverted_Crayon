"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/admin-guard";
import { setAdminSession } from "@/lib/session";
import { isLocked, lockoutMessage, nextLockoutState } from "@/lib/login-lockout";
import { notifyLoginLockout } from "@/lib/notifications";

export type ChangePasswordResult = { ok: boolean; message: string };

/**
 * Lets a signed-in admin or staff member change their OWN password (never anyone else's). It asks
 * for the current password first; a wrong one counts toward the same lockout as a wrong login, so a
 * stolen session can't be used to guess it. On success every other session of the account is signed
 * out (passwordChangedAt — see getCurrentAdmin) and this device is re-issued a fresh one.
 */
export async function changeOwnPassword(_prev: ChangePasswordResult | null, formData: FormData): Promise<ChangePasswordResult> {
  const admin = await getCurrentAdmin();
  if (!admin) return { ok: false, message: "You're not signed in." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!current) return { ok: false, message: "Enter your current password." };
  if (next.length < 8) return { ok: false, message: "The new password must be at least 8 characters." };
  if (next.length > 72) return { ok: false, message: "The new password can be at most 72 characters." };
  if (next !== confirm) return { ok: false, message: "The two new passwords don't match." };
  if (next === current) return { ok: false, message: "Choose a password that's different from the current one." };

  const user = await db.adminUser.findUnique({ where: { id: admin.id } });
  if (!user) return { ok: false, message: "Account not found." };
  if (!user.passwordHash) {
    return { ok: false, message: "This account signs in with Google, so it has no password to change." };
  }
  if (isLocked(user.lockedUntil)) return { ok: false, message: lockoutMessage(user.lockedUntil!) };

  if (!(await bcrypt.compare(current, user.passwordHash))) {
    const state = nextLockoutState(user.failedLoginCount);
    await db.adminUser.update({ where: { id: user.id }, data: state });
    if (state.lockedUntil) {
      await notifyLoginLockout({
        email: user.email,
        role: user.role === "ADMIN" ? "Admin" : "Staff",
        attempts: state.failedLoginCount,
        lockedUntil: state.lockedUntil,
      });
      return { ok: false, message: lockoutMessage(state.lockedUntil) };
    }
    return { ok: false, message: "Your current password isn't right." };
  }

  await db.adminUser.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(next, 10),
      passwordChangedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  // This device stays signed in on a fresh session; every older one (any other device) is now stale.
  await setAdminSession({ adminId: user.id, email: user.email, name: user.name, role: user.role });
  return { ok: true, message: "Password changed. Any other device signed in to this account has been signed out." };
}
