"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
}

const schema = z.object({
  id: z.string().optional(),
  slug: z.string().min(2),
  title: z.string().min(2),
  excerpt: z.string().min(1),
  body: z.string().min(1),
  accentColor: z.string().min(1),
  authorName: z.string().min(1),
  status: z.enum(["DRAFT", "PUBLISHED"]),
});

export type PostSaveResult = { ok: true; id: string } | { ok: false; error: string };

export async function savePost(input: z.infer<typeof schema>): Promise<PostSaveResult> {
  await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const existing = data.id ? await db.post.findUnique({ where: { id: data.id } }) : null;

  try {
    const post = await db.post.upsert({
      where: { id: data.id ?? "__new__" },
      update: {
        slug: data.slug,
        title: data.title,
        excerpt: data.excerpt,
        body: data.body,
        accentColor: data.accentColor,
        authorName: data.authorName,
        status: data.status,
        publishedAt: data.status === "PUBLISHED" ? (existing?.publishedAt ?? new Date()) : null,
      },
      create: {
        slug: data.slug,
        title: data.title,
        excerpt: data.excerpt,
        body: data.body,
        accentColor: data.accentColor,
        authorName: data.authorName,
        status: data.status,
        publishedAt: data.status === "PUBLISHED" ? new Date() : null,
      },
    });
    revalidatePath("/admin/journal");
    revalidatePath("/journal");
    revalidatePath(`/journal/${post.slug}`);
    return { ok: true, id: post.id };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { ok: false, error: "That slug is already in use." };
    }
    return { ok: false, error: "Something went wrong saving this post." };
  }
}

export async function deletePost(id: string) {
  await requireAdmin();
  await db.post.delete({ where: { id } });
  revalidatePath("/admin/journal");
  revalidatePath("/journal");
  redirect("/admin/journal");
}
