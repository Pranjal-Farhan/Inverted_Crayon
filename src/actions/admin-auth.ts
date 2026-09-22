"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { setAdminSession, clearAdminSession } from "@/lib/session";

export async function adminLogin(
  _prev: { ok: boolean; error: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const user = await db.adminUser.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { ok: false, error: "Invalid email or password." };
  }

  await setAdminSession({ adminId: user.id, email: user.email, name: user.name, role: user.role });
  redirect("/admin/dashboard");
}

export async function adminLogout() {
  await clearAdminSession();
  redirect("/admin/login");
}
