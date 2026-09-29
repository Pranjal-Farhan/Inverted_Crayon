import { db } from "@/lib/db";
import { deriveProductDisplay } from "@/lib/product-view";

export async function getProductForPDP(slug: string) {
  const [product, campaigns] = await Promise.all([
    db.product.findUnique({
      where: { slug },
      include: {
        variants: true,
        images: { orderBy: { position: "asc" } },
        tags: { include: { tag: true } },
        category: true,
        reviews: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" } },
      },
    }),
    db.campaign.findMany({
      where: { active: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
    }),
  ]);
  if (!product) return null;

  const now = new Date();
  const display = deriveProductDisplay(product, campaigns, now);

  const relatedRaw = await db.product.findMany({
    where: { categoryId: product.categoryId, id: { not: product.id }, status: "ACTIVE" },
    include: { variants: true, images: true, tags: { include: { tag: true } }, category: true },
    take: 4,
  });
  const related = relatedRaw.map((p) => deriveProductDisplay(p, campaigns, now));

  return { product, display, related };
}
