"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { setAdminSession, clearAdminSession } from "@/lib/session";
import { isLocked, lockoutMessage, nextLockoutState } from "@/lib/login-lockout";

export async function adminLogin(
  _prev: { ok: boolean; error: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await db.adminUser.findUnique({ where: { email } });

  if (user && isLocked(user.lockedUntil)) {
    return { ok: false, error: lockoutMessage(user.lockedUntil!) };
  }

  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    if (user) {
      const next = nextLockoutState(user.failedLoginCount);
      await db.adminUser.update({ where: { id: user.id }, data: next });
    }
    return { ok: false, error: "Invalid email or password." };
  }

  if (user.failedLoginCount > 0) {
    await db.adminUser.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }

  await setAdminSession({ adminId: user.id, email: user.email, name: user.name, role: user.role });
  redirect("/admin/dashboard");
}

export async function adminLogout() {
  await clearAdminSession();
  redirect("/admin/login");
}
