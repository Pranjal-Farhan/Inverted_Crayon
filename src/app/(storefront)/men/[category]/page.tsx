import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryByGenderSlug } from "@/lib/public-cache";
import { PLPView } from "@/components/storefront/PLPView";
import { parsePLPParams } from "@/lib/parse-plp-params";
import type { RawSearchParams } from "@/lib/plp-url";

type Props = {
  params: Promise<{ category: string }>;
  searchParams: Promise<RawSearchParams>;
};

// Stays dynamic (ƒ): reads searchParams below to drive server-side sort/filter/pagination,
// preserving the existing shareable-URL behavior rather than moving filtering client-side — see
// "Fix 2e" in the perf report for why this was the safer call. The underlying catalog fetch
// itself is cached (src/lib/plp.ts), so this no longer costs a DB round-trip on every request.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = await getCategoryByGenderSlug("MEN", category);
  return { title: cat ? `Men / ${cat.name}` : "Men" };
}

export default async function MenCategoryPage({ params, searchParams }: Props) {
  const { category } = await params;
  const cat = await getCategoryByGenderSlug("MEN", category);
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
