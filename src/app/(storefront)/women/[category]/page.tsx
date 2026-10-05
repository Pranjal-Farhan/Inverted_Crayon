import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryByGenderSlug, getGenderCategories } from "@/lib/public-cache";
import { StaticPLPView } from "@/components/storefront/StaticPLPView";

type Props = {
  params: Promise<{ category: string }>;
};

// Now fully static (○/ISR), 300s revalidate — see the matching comment in men/[category]/page.tsx.
export const revalidate = 300;

export async function generateStaticParams() {
  try {
    const categories = await getGenderCategories("WOMEN");
    return categories.map((c) => ({ category: c.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = await getCategoryByGenderSlug("WOMEN", category);
  return { title: cat ? `Women / ${cat.name}` : "Women", alternates: { canonical: `/women/${category}` } };
}

export default async function WomenCategoryPage({ params }: Props) {
  const { category } = await params;
  const cat = await getCategoryByGenderSlug("WOMEN", category);
  if (!cat) notFound();

  return (
    <StaticPLPView
      gender="WOMEN"
      categorySlug={category}
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
