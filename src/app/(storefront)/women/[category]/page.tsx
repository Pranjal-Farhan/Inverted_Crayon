import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { PLPView } from "@/components/storefront/PLPView";
import { parsePLPParams } from "@/lib/parse-plp-params";
import type { RawSearchParams } from "@/lib/plp-url";

type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = await db.category.findFirst({ where: { gender: "WOMEN", slug: category } });
  return { title: cat ? `Women / ${cat.name}` : "Women" };
}

export default async function WomenCategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  const cat = await db.category.findFirst({ where: { gender: "WOMEN", slug: category } });
  if (!cat) notFound();

  const rest = parsePLPParams(await searchParams);

  return (
    <PLPView
      params={{ gender: "WOMEN", categorySlug: category, ...rest }}
      title={
        <>
          Women / <span className="text-lime">{cat.name}</span>
        </>
      }
      breadcrumb={
        <div className="font-label text-sm tracking-[1.4px] text-muted">
          <Link href="/women">Women</Link> / {cat.name}
        </div>
      }
    />
  );
}
