import { db } from "@/lib/db";
import { deriveProductDisplay } from "@/lib/product-view";

export async function getProductForPDP(slug: string) {
  const product = await db.product.findUnique({
    where: { slug },
    include: {
      variants: true,
      images: true,
      tags: { include: { tag: true } },
      category: true,
      reviews: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!product) return null;

  const now = new Date();
  const campaigns = await db.campaign.findMany({
    where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
  });
  const display = deriveProductDisplay(product, campaigns, now);

  const relatedRaw = await db.product.findMany({
    where: { categoryId: product.categoryId, id: { not: product.id }, status: "ACTIVE" },
    include: { variants: true, images: true, tags: { include: { tag: true } }, category: true },
    take: 4,
  });
  const related = relatedRaw.map((p) => deriveProductDisplay(p, campaigns, now));

  return { product, display, related };
}
