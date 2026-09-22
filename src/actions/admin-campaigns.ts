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
  name: z.string().min(2),
  percentOff: z.number().min(0).max(100).nullable(),
  targetCategoryId: z.string().nullable(),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  active: z.boolean(),
});

export async function saveCampaign(input: z.infer<typeof schema>) {
  await requireAdmin();
  const data = schema.parse(input);
  await db.campaign.upsert({
    where: { id: data.id ?? "__new__" },
    update: {
      name: data.name,
      percentOff: data.percentOff,
      targetCategoryId: data.targetCategoryId,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      active: data.active,
    },
    create: {
      name: data.name,
      percentOff: data.percentOff,
      targetCategoryId: data.targetCategoryId,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      active: data.active,
    },
  });
  revalidatePath("/admin/campaigns");
  revalidatePath("/sale");
}

export async function deleteCampaign(id: string) {
  await requireAdmin();
  await db.campaign.delete({ where: { id } });
  revalidatePath("/admin/campaigns");
  revalidatePath("/sale");
}
