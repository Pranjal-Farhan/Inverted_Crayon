import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PLPView } from "@/components/storefront/PLPView";
import { parsePLPParams } from "@/lib/parse-plp-params";
import { CATEGORIES } from "@/lib/categories";
import type { RawSearchParams } from "@/lib/plp-url";

type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<RawSearchParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = CATEGORIES.find((c) => c.slug === category);
  return { title: cat ? `Men / ${cat.name}` : "Men" };
}

export default async function MenCategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  const cat = CATEGORIES.find((c) => c.slug === category);
  if (!cat) notFound();

  const rest = parsePLPParams(await searchParams);

  return (
    <PLPView
      params={{ gender: "MEN", categorySlug: category, ...rest }}
      title={
        <>
          Men / <span className="text-lime">{cat.name}</span>
        </>
      }
      breadcrumb={
        <div className="font-label text-sm tracking-[1.4px] text-muted">
          <Link href="/men">Men</Link> / {cat.name}
        </div>
      }
    />
  );
}
