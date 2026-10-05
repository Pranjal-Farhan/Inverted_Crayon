import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAllPublishedPostSlugs, getCachedPostBySlug } from "@/lib/public-cache";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { pickAccent } from "@/lib/accent-color";

type Props = { params: Promise<{ slug: string }> };

// Safety-net revalidation on top of the tag-based invalidation in public-cache.ts.
export const revalidate = 3600;

export async function generateStaticParams() {
  const slugs = await getAllPublishedPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // generateMetadata still needs to resolve a title for an unpublished/future post hit directly
  // by slug (e.g. an admin preview link), so this one read stays uncached and unfiltered by status.
  const post = await db.post.findUnique({ where: { slug } });
  return { title: post?.title ?? "Journal" };
}

export default async function JournalPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getCachedPostBySlug(slug);
  if (!post) notFound();
  const accent = pickAccent(post.id);

  return (
    <section className="pg pb-16">
      <div className="pt-8">
        <Link href="/journal" className="font-label text-sm tracking-[1.4px] text-muted hover:text-lime">
          ← Journal
        </Link>
      </div>
      <div className="mx-auto max-w-[720px] py-4">
        <p className="mb-2 text-[13px] text-muted">
          {post.publishedAt?.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · {post.authorName}
        </p>
        <h1 className="font-impact text-[clamp(32px,5vw,52px)] uppercase leading-[0.9]">{post.title}</h1>
        <div className="my-5 aspect-[16/9]">
          <PlaceholderFrame accentColor={post.accentColor || accent.color} shape={accent.shape} className="h-full w-full" />
        </div>
        <div className="whitespace-pre-wrap text-[#d3d3d1]">{post.body}</div>
      </div>
    </section>
  );
}
