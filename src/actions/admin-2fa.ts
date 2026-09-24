"use server";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { generateTotpSecret, totpAuthUri, verifyTotpCode, generateBackupCodes } from "@/lib/totp";

/**
 * Starts (or restarts) 2FA setup for the logged-in admin: a fresh secret is generated and saved,
 * but twoFactorEnabled stays false until confirmTwoFactorSetup verifies the admin actually has it
 * working in an authenticator app. Re-running this before confirming just replaces the pending secret.
 */
export async function initiateTwoFactorSetup(): Promise<
  { ok: true; qrDataUrl: string; manualKey: string } | { ok: false; error: string }
> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const admin = await db.adminUser.findUnique({ where: { id: session.adminId } });
  if (!admin) return { ok: false, error: "Account not found." };
  if (admin.twoFactorEnabled) return { ok: false, error: "Two-factor authentication is already enabled." };

  const secret = generateTotpSecret();
  await db.adminUser.update({ where: { id: admin.id }, data: { twoFactorSecret: secret } });

  const uri = totpAuthUri(secret, admin.email);
  const qrDataUrl = await QRCode.toDataURL(uri);

  return { ok: true, qrDataUrl, manualKey: secret };
}

export async function confirmTwoFactorSetup(
  _prev: { ok: boolean; error: string; backupCodes: string[] } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string; backupCodes: string[] }> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Not signed in.", backupCodes: [] };

  const code = String(formData.get("code") ?? "");
  const admin = await db.adminUser.findUnique({ where: { id: session.adminId } });
  if (!admin?.twoFactorSecret) {
    return { ok: false, error: "Start setup again — no pending secret found.", backupCodes: [] };
  }

  if (!verifyTotpCode(admin.twoFactorSecret, code)) {
    return { ok: false, error: "That code didn't match. Check the time on your device and try again.", backupCodes: [] };
  }

  const backupCodes = generateBackupCodes(8);
  const hashedCodes = await Promise.all(backupCodes.map((c) => bcrypt.hash(c, 10)));

  await db.adminUser.update({
    where: { id: admin.id },
    data: { twoFactorEnabled: true, twoFactorBackupCodes: hashedCodes },
  });

  return { ok: true, error: "", backupCodes };
}

export async function disableTwoFactor(
  _prev: { ok: boolean; error: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string }> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const password = String(formData.get("password") ?? "");
  const admin = await db.adminUser.findUnique({ where: { id: session.adminId } });
  if (!admin) return { ok: false, error: "Account not found." };
  if (!admin.passwordHash || !(await bcrypt.compare(password, admin.passwordHash))) {
    return { ok: false, error: "Incorrect password." };
  }

  await db.adminUser.update({
    where: { id: admin.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
  });

  return { ok: true, error: "" };
}
