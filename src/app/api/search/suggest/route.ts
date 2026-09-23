import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([]);

  const products = await db.product.findMany({
    where: { status: "ACTIVE", title: { contains: q, mode: "insensitive" } },
    select: { title: true, slug: true, basePrice: true },
    take: 6,
    orderBy: { publishedAt: "desc" },
  });

  return NextResponse.json(
    products.map((p) => ({ title: p.title, slug: p.slug, price: Number(p.basePrice) })),
  );
}
