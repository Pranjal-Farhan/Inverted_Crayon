"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { setCustomerSession, clearCustomerSession } from "@/lib/session";

export async function customerLogin(
  _prev: { ok: boolean; error: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const customer = await db.customer.findUnique({ where: { email } });
  if (!customer || !customer.passwordHash || !(await bcrypt.compare(password, customer.passwordHash))) {
    return { ok: false, error: "Invalid email or password." };
  }

  await setCustomerSession({ customerId: customer.id, email: customer.email, name: customer.name });
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

  const existing = await db.customer.findUnique({ where: { email } });
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  // registering with an email used for guest orders claims those orders (§08)
  const customer = existing
    ? await db.customer.update({ where: { email }, data: { passwordHash, name: parsed.data.name } })
    : await db.customer.create({ data: { email, passwordHash, name: parsed.data.name } });

  await db.order.updateMany({ where: { email, customerId: null }, data: { customerId: customer.id } });

  await setCustomerSession({ customerId: customer.id, email: customer.email, name: customer.name });
  redirect("/account");
}

export async function customerLogout() {
  await clearCustomerSession();
  redirect("/account/login");
}
