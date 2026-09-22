"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
}

const schema = z.object({
  id: z.string().optional(),
  title: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().optional(),
  heroCopy: z.string().optional(),
  active: z.boolean(),
});

export async function saveCollection(input: z.infer<typeof schema>) {
  await requireAdmin();
  const data = schema.parse(input);
  await db.collection.upsert({
    where: { id: data.id ?? "__new__" },
    update: data,
    create: data,
  });
  revalidatePath("/admin/categories");
  revalidatePath("/drops");
}

export async function deleteCollection(id: string) {
  await requireAdmin();
  await db.collection.delete({ where: { id } });
  revalidatePath("/admin/categories");
}
