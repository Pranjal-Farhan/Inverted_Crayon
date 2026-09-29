import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { deriveProductDisplay, type ProductWithRelations } from "@/lib/product-view";

type RecentImage = {
  id: string;
  productId: string;
  url: string;
  alt: string | null;
  position: number;
  accentColor: string | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 10);
  if (ids.length === 0) return NextResponse.json([]);

  const now = new Date();
  const [products, campaigns, images] = await Promise.all([
    db.product.findMany({
      where: { id: { in: ids }, status: "ACTIVE" },
      include: { variants: true, tags: { include: { tag: true } }, category: true },
    }),
    db.campaign.findMany({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } } }),
    db.$queryRaw<RecentImage[]>(Prisma.sql`
      SELECT "id", "productId", "alt", "position", "accentColor",
        CASE WHEN "url" LIKE 'data:%' THEN '' ELSE "url" END AS "url"
      FROM "ProductImage"
      WHERE "productId" IN (${Prisma.join(ids)})
      ORDER BY "position" ASC
    `),
  ]);

  // preserve the requested (most-recent-first) order
  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = ids.map((id) => byId.get(id)).filter((p) => p != null);

  const imagesByProduct = new Map<string, RecentImage[]>();
  for (const image of images) {
    const productImages = imagesByProduct.get(image.productId) ?? [];
    productImages.push(image);
    imagesByProduct.set(image.productId, productImages);
  }

  return NextResponse.json(
    ordered.map((product) =>
      deriveProductDisplay(
        { ...product, images: imagesByProduct.get(product.id) ?? [] } as ProductWithRelations,
        campaigns,
        now,
      ),
    ),
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } },
  );
}
