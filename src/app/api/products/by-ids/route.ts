import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deriveProductDisplay } from "@/lib/product-view";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 10);
  if (ids.length === 0) return NextResponse.json([]);

  const now = new Date();
  const [products, campaigns] = await Promise.all([
    db.product.findMany({
      where: { id: { in: ids }, status: "ACTIVE" },
      include: { variants: true, images: true, tags: { include: { tag: true } }, category: true },
    }),
    db.campaign.findMany({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } } }),
  ]);

  // preserve the requested (most-recent-first) order
  const byId = new Map(products.map((p) => [p.id, p]));
  const ordered = ids.map((id) => byId.get(id)).filter((p) => p != null);

  return NextResponse.json(ordered.map((p) => deriveProductDisplay(p, campaigns, now)));
}
