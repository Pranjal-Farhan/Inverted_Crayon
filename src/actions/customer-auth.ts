"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { setCustomerSession, clearCustomerSession } from "@/lib/session";
import { isLocked, lockoutMessage, nextLockoutState } from "@/lib/login-lockout";

export async function customerLogin(
  _prev: { ok: boolean; error: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const customer = await db.customer.findUnique({ where: { email } });

  if (customer && isLocked(customer.lockedUntil)) {
    return { ok: false, error: lockoutMessage(customer.lockedUntil!) };
  }

  if (!customer || !customer.passwordHash || !(await bcrypt.compare(password, customer.passwordHash))) {
    if (customer) {
      const next = nextLockoutState(customer.failedLoginCount);
      await db.customer.update({ where: { id: customer.id }, data: next });
    }
    return { ok: false, error: "Invalid email or password." };
  }

  if (customer.failedLoginCount > 0) {
    await db.customer.update({ where: { id: customer.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  }

  await setCustomerSession({ customerId: customer.id, email: customer.email, name: customer.name, avatarUrl: customer.avatarUrl });
  redirect("/account");
}

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
});

export async function customerRegister(
  _prev: { ok: boolean; error: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string }> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: "That didn't go through. Check the fields in red and try again." };
  }
  const email = parsed.data.email.toLowerCase();

  // Refuse to touch an account that already exists — every Customer row already has a way to
  // log in (a passwordHash from an earlier registration, or a googleId/facebookId from OAuth),
  // so silently overwriting it here would let anyone take over any account just by knowing its
  // email address. Guest orders (customerId: null) never create a Customer row, so this can't
  // block the legitimate "claim my guest orders" case below.
  const existing = await db.customer.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with that email already exists. Please log in instead." };
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const customer = await db.customer.create({ data: { email, passwordHash, name: parsed.data.name } });

  // registering with an email used for guest orders claims those orders (§08)
  await db.order.updateMany({ where: { email, customerId: null }, data: { customerId: customer.id } });

  await setCustomerSession({ customerId: customer.id, email: customer.email, name: customer.name, avatarUrl: customer.avatarUrl });
  redirect("/account");
}

export async function customerLogout() {
  await clearCustomerSession();
  redirect("/account/login");
}
