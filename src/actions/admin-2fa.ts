"use server";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getCurrentAdmin } from "@/lib/admin-guard";
import { setAdminSession } from "@/lib/session";
import { isLocked, lockoutMessage, nextLockoutState } from "@/lib/login-lockout";
import { notifyLoginLockout } from "@/lib/notifications";
import { generateTotpSecret, totpAuthUri, matchTotpStep, generateBackupCodes } from "@/lib/totp";
import { consumeSecondFactor } from "@/lib/two-factor";

/*
 * Every action here acts on the account that is signed in right now — found through
 * getCurrentAdmin(), which reads the account from the database rather than trusting the cookie, so
 * a removed account or a session from before a password change can't touch anyone's 2FA — and on
 * nobody else's: there is no account id in any argument. The secret and backup codes live on that
 * account's own row and are never sent to the browser except the secret during setup, to the person
 * setting it up.
 */

/**
 * Starts (or restarts) 2FA setup for the logged-in admin: a fresh secret is generated and saved,
 * but twoFactorEnabled stays false until confirmTwoFactorSetup verifies the admin actually has it
 * working in an authenticator app. Re-running this before confirming just replaces the pending secret.
 */
export async function initiateTwoFactorSetup(): Promise<
  { ok: true; qrDataUrl: string; manualKey: string } | { ok: false; error: string }
> {
  const current = await getCurrentAdmin();
  if (!current) return { ok: false, error: "Not signed in." };

  const admin = await db.adminUser.findUnique({ where: { id: current.id } });
  if (!admin) return { ok: false, error: "Account not found." };
  if (admin.twoFactorEnabled) return { ok: false, error: "Two-factor authentication is already enabled." };

  const secret = generateTotpSecret();
  await db.adminUser.update({ where: { id: admin.id }, data: { twoFactorSecret: secret, twoFactorLastStep: null } });

  const uri = totpAuthUri(secret, admin.email);
  const qrDataUrl = await QRCode.toDataURL(uri);

  return { ok: true, qrDataUrl, manualKey: secret };
}

export async function confirmTwoFactorSetup(
  _prev: { ok: boolean; error: string; backupCodes: string[] } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string; backupCodes: string[] }> {
  const current = await getCurrentAdmin();
  if (!current) return { ok: false, error: "Not signed in.", backupCodes: [] };

  const code = String(formData.get("code") ?? "");
  const admin = await db.adminUser.findUnique({ where: { id: current.id } });
  if (!admin) return { ok: false, error: "Account not found.", backupCodes: [] };
  // Already on: confirming again would only mint new backup codes (and void the old ones).
  if (admin.twoFactorEnabled) return { ok: false, error: "Two-factor authentication is already enabled.", backupCodes: [] };
  if (!admin.twoFactorSecret) {
    return { ok: false, error: "Start setup again — no pending secret found.", backupCodes: [] };
  }

  const step = matchTotpStep(admin.twoFactorSecret, code);
  if (step === null) {
    return { ok: false, error: "That code didn't match. Check the time on your device and try again.", backupCodes: [] };
  }

  const backupCodes = generateBackupCodes(8);
  const hashedCodes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));

  await db.adminUser.update({
    where: { id: admin.id },
    data: {
      twoFactorEnabled: true,
      twoFactorBackupCodes: hashedCodes,
      // The code that just proved the setup can't also be replayed to sign in.
      twoFactorLastStep: step,
      // Sessions opened before this point had no second factor — sign them all out; this device keeps going.
      passwordChangedAt: new Date(),
    },
  });
  await setAdminSession({ adminId: admin.id, email: admin.email, name: admin.name, role: admin.role });

  return { ok: true, error: "", backupCodes };
}

/**
 * Turns 2FA off. It asks for BOTH the password and a current authenticator (or backup) code — a
 * stolen session cookie alone, or a stolen password alone, can't strip the protection. Wrong tries
 * count toward the same lockout as a wrong login.
 */
export async function disableTwoFactor(
  _prev: { ok: boolean; error: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string }> {
  const current = await getCurrentAdmin();
  if (!current) return { ok: false, error: "Not signed in." };

  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "");
  const admin = await db.adminUser.findUnique({ where: { id: current.id } });
  if (!admin) return { ok: false, error: "Account not found." };
  if (!admin.twoFactorEnabled) return { ok: false, error: "Two-factor authentication isn't turned on." };
  if (isLocked(admin.lockedUntil)) return { ok: false, error: lockoutMessage(admin.lockedUntil!) };

  // An account that signs in with Google has no password — for it the code alone proves it.
  const passwordOk = admin.passwordHash ? await bcrypt.compare(password, admin.passwordHash) : true;
  // The code is only spent once the password is right.
  const factor = passwordOk ? await consumeSecondFactor(admin, code) : null;

  if (!passwordOk || !factor) {
    const state = nextLockoutState(admin.failedLoginCount);
    await db.adminUser.update({ where: { id: admin.id }, data: state });
    if (state.lockedUntil) {
      await notifyLoginLockout({
        email: admin.email,
        role: admin.role === "ADMIN" ? "Admin" : "Staff",
        attempts: state.failedLoginCount,
        lockedUntil: state.lockedUntil,
      });
      return { ok: false, error: lockoutMessage(state.lockedUntil) };
    }
    return { ok: false, error: "That password or code isn't right." };
  }

  await db.adminUser.update({
    where: { id: admin.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
      twoFactorLastStep: null,
      failedLoginCount: 0,
      lockedUntil: null,
      passwordChangedAt: new Date(),
    },
  });
  await setAdminSession({ adminId: admin.id, email: admin.email, name: admin.name, role: admin.role });

  return { ok: true, error: "" };
}
