"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";

async function requireOwnAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
  return session;
}

const schema = z.object({
  email: z.email(),
  name: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "STAFF"]),
});

export type StaffResult = { ok: true } | { ok: false; error: string };

export async function inviteStaff(input: z.infer<typeof schema>): Promise<StaffResult> {
  await requireOwnAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const existing = await db.adminUser.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { ok: false, error: "An admin user with that email already exists." };

  await db.adminUser.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
    },
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function updateStaffRole(id: string, role: "ADMIN" | "STAFF") {
  const session = await requireOwnAdmin();
  if (session.adminId === id && role !== "ADMIN") {
    throw new Error("You can't demote your own account.");
  }
  await db.adminUser.update({ where: { id }, data: { role } });
  revalidatePath("/admin/settings");
}

export async function removeStaff(id: string) {
  const session = await requireOwnAdmin();
  if (session.adminId === id) throw new Error("You can't remove your own account.");

  const remainingAdmins = await db.adminUser.count({ where: { role: "ADMIN", id: { not: id } } });
  const target = await db.adminUser.findUniqueOrThrow({ where: { id } });
  if (target.role === "ADMIN" && remainingAdmins === 0) {
    throw new Error("Can't remove the last admin.");
  }

  await db.adminUser.delete({ where: { id } });
  revalidatePath("/admin/settings");
}
