import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryByGenderSlug, getGenderCategories } from "@/lib/public-cache";
import { StaticPLPView } from "@/components/storefront/StaticPLPView";

type Props = {
  params: Promise<{ category: string }>;
};

// Now fully static (○/ISR): no searchParams read anywhere in this file — filtering/sorting/
// pagination moved entirely client-side (see StaticPLPView.tsx / StaticPLPClient.tsx). Safety-net
// revalidation on top of the tag-based invalidation already wired in src/lib/invalidate.ts.
export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const categories = await getGenderCategories("MEN");
    return categories.map((c) => ({ category: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = await getCategoryByGenderSlug("MEN", category);
  // Canonical points at the clean URL without ?sort/?size/?color/etc — those params no longer
  // even reach the server, but a crawler could still encounter them in a shared link.
  return { title: cat ? `Men / ${cat.name}` : "Men", alternates: { canonical: `/men/${category}` } };
}

export default async function MenCategoryPage({ params }: Props) {
  const { category } = await params;
  const cat = await getCategoryByGenderSlug("MEN", category);
  if (!cat) notFound();

  return (
    <StaticPLPView
      gender="MEN"
      categorySlug={category}
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
