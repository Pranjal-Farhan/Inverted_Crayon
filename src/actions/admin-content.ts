"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import type { HeroData } from "@/lib/hero-defaults";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
}

export async function saveHomeHero(data: HeroData) {
  await requireAdmin();
  await db.contentBlock.upsert({ where: { key: "home_hero" }, update: { data }, create: { key: "home_hero", data } });
  revalidatePath("/");
  revalidatePath("/admin/content");
}

export async function saveFeaturedDrop(productId: string | null) {
  await requireAdmin();
  await db.contentBlock.upsert({
    where: { key: "home_featured_drop" },
    update: { data: { productId } },
    create: { key: "home_featured_drop", data: { productId } },
  });
  revalidatePath("/");
  revalidatePath("/admin/content");
}

const MAX_SITE_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_HERO_IMAGES = 8;
const REJECTED_IMAGE_TYPES = new Set(["image/svg+xml"]);

async function saveSiteImage(file: File, subdir: "logo" | "hero"): Promise<string> {
  const dir = path.join(process.cwd(), "public", "uploads", "site", subdir);
  await fs.mkdir(dir, { recursive: true });
  const nameExt = file.name.includes(".") ? file.name.split(".").pop() : null;
  const mimeExt = file.type.split("/")[1]?.split("+")[0];
  const ext = (nameExt || mimeExt || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const filename = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return `/uploads/site/${subdir}/${filename}`;
}

export type UploadSiteImageResult = { ok: true; url: string } | { ok: false; error: string };

export async function uploadLogoImage(formData: FormData): Promise<UploadSiteImageResult> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file received." };
  if (file.size > MAX_SITE_IMAGE_BYTES) return { ok: false, error: "Image must be under 8MB." };
  if (!file.type.startsWith("image/") || REJECTED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: "Only JPG, PNG, WEBP, GIF or AVIF images are accepted." };
  }
  const url = await saveSiteImage(file, "logo");
  revalidatePath("/");
  revalidatePath("/admin/content");
  return { ok: true, url };
}

export async function uploadHeroImages(formData: FormData): Promise<{ ok: true; urls: string[] } | { ok: false; error: string }> {
  await requireAdmin();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "No files received." };
  if (files.length > MAX_HERO_IMAGES) return { ok: false, error: `Upload at most ${MAX_HERO_IMAGES} images at a time.` };
  if (files.some((f) => f.size > MAX_SITE_IMAGE_BYTES)) return { ok: false, error: "Each image must be under 8MB." };

  const imageFiles = files.filter((f) => f.type.startsWith("image/") && !REJECTED_IMAGE_TYPES.has(f.type));
  if (imageFiles.length === 0) return { ok: false, error: "Only JPG, PNG, WEBP, GIF or AVIF images are accepted." };

  const urls = await Promise.all(imageFiles.map((f) => saveSiteImage(f, "hero")));
  revalidatePath("/");
  revalidatePath("/admin/content");
  return { ok: true, urls };
}
