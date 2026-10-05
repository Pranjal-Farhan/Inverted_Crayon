import Link from "next/link";
import type { Metadata } from "next";
import { getPublishedPosts } from "@/lib/public-cache";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { pickAccent } from "@/lib/accent-color";

export const metadata: Metadata = { title: "Journal" };
export const revalidate = 3600;

export default async function JournalPage() {
  const posts = await getPublishedPosts();

  return (
    <section className="pg pb-16">
      <div className="pt-8 pb-1.5">
        <span className="font-scrawl text-[15px] text-pink">Dispatches</span>
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">Journal</h1>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 desktop:grid-cols-3">
        {posts.map((p) => {
          const accent = pickAccent(p.id);
          return (
            <Link key={p.id} href={`/journal/${p.slug}`} className="block">
              <div className="aspect-[4/3]">
                <PlaceholderFrame accentColor={p.accentColor || accent.color} shape={accent.shape} className="h-full w-full" />
              </div>
              <p className="mt-2.5 text-[12px] text-muted">
                {p.publishedAt?.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · {p.authorName}
              </p>
              <h3 className="font-impact mt-1 text-xl uppercase leading-tight">{p.title}</h3>
              <p className="mt-1 text-sm text-muted">{p.excerpt}</p>
            </Link>
          );
        })}
        {posts.length === 0 && <p className="text-muted">Nothing published yet — check back soon.</p>}
      </div>
    </section>
  );
}
