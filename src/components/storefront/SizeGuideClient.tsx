"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getSizeGuideForProduct } from "@/actions/size-guide-lookup";
import type { SizeGuideData } from "@/lib/size-guide";
import { SizeGuideReadTable } from "@/components/storefront/SizeGuideReadTable";

/** What the lookup for one slug came back with. `slug` ties a result to the product it was fetched
 * for, so a stale result is never shown after the ?product= param changes. */
type Lookup =
  | { slug: string; status: "ready"; title: string; table: SizeGuideData }
  | { slug: string; status: "empty"; title: string } // product exists, admins entered no size guide
  | { slug: string; status: "missing" } // no product with that slug
  | { slug: string; status: "error" };

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mx-auto mt-3 max-w-[52ch] text-center text-muted">{children}</p>;
}

function NoticeLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <p className="mt-4 text-center font-label text-sm text-cyan">
      <Link href={href} prefetch={false}>
        {children}
      </Link>
    </p>
  );
}

/**
 * Reads the ?product= query param client-side (useSearchParams, which is why this needs the
 * Suspense boundary in size-guide/page.tsx) and fetches that product's own size guide via a server
 * action. A product's guide is only ever what its admins entered: when there isn't one (or there's
 * no ?product= at all) this says so plainly instead of showing a stand-in chart.
 */
export function SizeGuideClient() {
  const slug = useSearchParams().get("product");
  const [lookup, setLookup] = useState<Lookup | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    getSizeGuideForProduct(slug)
      .then((res): Lookup =>
        !res
          ? { slug, status: "missing" }
          : res.table
            ? { slug, status: "ready", title: res.title, table: res.table }
            : { slug, status: "empty", title: res.title },
      )
      .catch((): Lookup => ({ slug, status: "error" }))
      .then((next) => {
        if (!cancelled) setLookup(next);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug) {
    return (
      <>
        <Notice>
          Measurements live on each product page — open a product and tap &ldquo;Size guide &rarr;&rdquo; (shown on
          products that have one).
        </Notice>
        <NoticeLink href="/new">Shop new arrivals →</NoticeLink>
      </>
    );
  }

  // Only trust a result that was fetched for the slug currently in the URL.
  const current = lookup?.slug === slug ? lookup : null;
  if (!current) return <Notice>Loading size guide…</Notice>;

  switch (current.status) {
    case "ready":
      return (
        <>
          <Notice>
            Measurements in inches for <span className="text-paper">{current.title}</span>.
          </Notice>
          <SizeGuideReadTable table={current.table} />
        </>
      );
    case "empty":
      return (
        <>
          <Notice>
            <span className="text-paper">{current.title}</span> doesn&apos;t have a size guide yet.
          </Notice>
          <NoticeLink href={`/product/${current.slug}`}>← Back to the product</NoticeLink>
        </>
      );
    case "missing":
      return (
        <>
          <Notice>We couldn&apos;t find that product.</Notice>
          <NoticeLink href="/new">Shop new arrivals →</NoticeLink>
        </>
      );
    case "error":
      return <Notice>We couldn&apos;t load this size guide right now. Please refresh to try again.</Notice>;
  }
}
