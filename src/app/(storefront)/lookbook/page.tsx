import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { pickAccent } from "@/lib/accent-color";

export const metadata: Metadata = { title: "Lookbook" };

export default async function LookbookPage() {
  const products = await db.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { publishedAt: "desc" },
    take: 8,
  });

  return (
    <section className="pg pb-16">
      <div className="pt-8 pb-1.5">
        <span className="font-scrawl text-[15px] text-pink">On the streets</span>
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">Lookbook</h1>
      </div>
      <div className="mt-5 grid grid-cols-2 desktop:grid-cols-4 items-start gap-4" style={{ gridAutoRows: 220 }}>
        {products.map((p, i) => {
          const accent = pickAccent(p.id);
          const spanRow = i === 0;
          const spanCol = i === 3;
          return (
            <Link
              key={p.id}
              href={`/product/${p.slug}`}
              className="relative block"
              style={{
                gridRow: spanRow ? "span 2" : undefined,
                gridColumn: spanCol ? "span 2" : undefined,
                height: spanRow ? 460 : 220,
              }}
            >
              <PlaceholderFrame accentColor={accent.color} shape={accent.shape} label={`LOOK 0${i + 1}`} className="h-full w-full" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
