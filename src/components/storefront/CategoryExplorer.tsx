"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { ProductCard } from "@/components/ui/ProductCard";
import { HandDrawnMark, pickMark } from "@/components/brand/HandDrawnMarks";
import { pickAccent } from "@/lib/accent-color";
import type { ExplorerCategory } from "@/lib/public-cache";
import type { ProductDisplay } from "@/lib/product-view";

/**
 * Homepage "Shop by category" — a 3-step drill-down (gender cards -> subcategory cards -> product
 * grid), each step swapping in with a staggered card reveal and animated hand-drawn marks. All the
 * data for every step arrives as props from the single cached homepage render (see
 * getHomeCategoryExplorerData in public-cache.ts) — clicking through never hits the server, so this
 * stays free in Vercel function-invocation terms no matter how many times a visitor clicks around.
 */

type Step =
  | { kind: "gender" }
  | { kind: "category"; gender: "MEN" | "WOMEN" }
  | { kind: "products"; gender: "MEN" | "WOMEN"; category: ExplorerCategory };

const EXIT_MS = 280;

export function CategoryExplorer({
  maleImageUrl,
  femaleImageUrl,
  men,
  women,
  productsByCategory,
}: {
  maleImageUrl: string | null;
  femaleImageUrl: string | null;
  men: ExplorerCategory[];
  women: ExplorerCategory[];
  productsByCategory: Record<string, ProductDisplay[]>;
}) {
  const [step, setStep] = useState<Step>({ kind: "gender" });
  const [leaving, setLeaving] = useState(false);
  const [stepKey, setStepKey] = useState(0);

  function go(next: Step) {
    setLeaving(true);
    window.setTimeout(() => {
      setStep(next);
      setLeaving(false);
      setStepKey((k) => k + 1);
    }, EXIT_MS);
  }

  const genderPath = step.kind !== "gender" ? (step.gender === "MEN" ? "men" : "women") : null;

  return (
    <div>
      {step.kind !== "gender" && (
        <button
          type="button"
          onClick={() => go(step.kind === "products" ? { kind: "category", gender: step.gender } : { kind: "gender" })}
          className="font-label mb-4 flex items-center gap-1.5 text-[12px] tracking-[1.4px] text-muted hover:text-lime"
        >
          <span aria-hidden="true">←</span> Back
        </button>
      )}

      <div key={stepKey} className={leaving ? "ce-step-leaving" : undefined}>
        {step.kind === "gender" && (
          <div className="grid grid-cols-1 gap-5 desktop:grid-cols-2">
            <GenderCard
              label="Men"
              imageUrl={maleImageUrl}
              accentA="#26a7e6"
              accentB="#ffd23b"
              index={0}
              onClick={() => go({ kind: "category", gender: "MEN" })}
            />
            <GenderCard
              label="Women"
              imageUrl={femaleImageUrl}
              accentA="#ff2d84"
              accentB="#c3f53a"
              index={1}
              onClick={() => go({ kind: "category", gender: "WOMEN" })}
            />
          </div>
        )}

        {step.kind === "category" && (
          <div className="grid grid-cols-2 gap-4 desktop:grid-cols-4">
            {(step.gender === "MEN" ? men : women).map((c, i) => (
              <CategoryCard
                key={c.id}
                category={c}
                index={i}
                onClick={() => go({ kind: "products", gender: step.gender, category: c })}
              />
            ))}
          </div>
        )}

        {step.kind === "products" && genderPath && (
          <ProductsStep category={step.category} genderPath={genderPath} products={productsByCategory[step.category.id] ?? []} />
        )}
      </div>
    </div>
  );
}

function GenderCard({
  label,
  imageUrl,
  accentA,
  accentB,
  index,
  onClick,
}: {
  label: "Men" | "Women";
  imageUrl: string | null;
  accentA: string;
  accentB: string;
  index: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  // The mark overlays live on this outer wrapper, not inside the button below — the button needs
  // overflow-hidden to crop its photo/placeholder, which would also clip a mark positioned to bleed
  // past the card's edge (the "drawn around it" look the reference sheets have). Keeping the marks
  // as unclipped siblings, pointer-events: none (globals.css's .ce-mark), lets them hang over the
  // edge while clicks still land on the button beneath.
  return (
    <div
      className="ce-card relative"
      style={{ animationDelay: `${index * 100}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onClick}
        className="group relative flex min-h-[320px] w-full items-end overflow-hidden border border-line bg-ink text-left desktop:min-h-[400px]"
      >
        {imageUrl ? (
          <>
            <Image
              src={imageUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="absolute inset-0 z-[1] h-full w-full object-cover transition duration-300 ease-out group-hover:scale-[1.04]"
            />
            <div className="absolute inset-x-0 bottom-0 z-[2] h-1/2 bg-gradient-to-t from-ink/85 to-transparent" />
          </>
        ) : (
          <PlaceholderFrame
            accentColor={accentA}
            shape={label === "Men" ? "arrow" : "circle"}
            stamp={false}
            className="absolute inset-0 z-[1] h-full w-full"
          />
        )}
        <span className="font-impact relative z-[4] p-5 text-[36px] uppercase leading-none tracking-[1px] desktop:text-[48px]">
          {label}
        </span>
      </button>
      <HandDrawnMark
        id={`gender-${label}-a`}
        kind="arrow-curve"
        color={accentA}
        duration={800}
        delay={160}
        className="ce-mark -left-4 -top-4 z-[5] h-20 w-28 -rotate-6"
      />
      {/* Hover/focus-only "circle this" mark — roughly covers the whole card, draws on when this
          card gains the pointer/focus and undraws (same transition, reversed) when it loses it. */}
      <HandDrawnMark
        id={`gender-${label}-hover`}
        kind="circle-loop"
        color={accentB}
        duration={500}
        visible={hovered}
        stretch
        className="ce-mark absolute -inset-5 z-[6] -rotate-2"
      />
    </div>
  );
}

function CategoryCard({ category, index, onClick }: { category: ExplorerCategory; index: number; onClick: () => void }) {
  const accent = pickAccent(`explorer-${category.gender}-${category.slug}`);
  const mark = pickMark(`explorer-mark-${category.gender}-${category.slug}`);
  const hoverColor = pickMark(`explorer-hover-${category.gender}-${category.slug}`, mark.color).color;
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="ce-card relative"
      style={{ animationDelay: `${index * 70}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onClick}
        className="group relative flex aspect-[1/1.2] w-full items-end overflow-hidden border border-line bg-ink text-left"
      >
        {category.imageUrl ? (
          <>
            <Image
              src={category.imageUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 25vw, 50vw"
              className="absolute inset-0 z-[1] h-full w-full object-cover transition duration-300 ease-out group-hover:scale-[1.05]"
            />
            <div className="absolute inset-x-0 bottom-0 z-[2] h-1/2 bg-gradient-to-t from-ink/80 to-transparent" />
          </>
        ) : (
          <PlaceholderFrame accentColor={accent.color} shape={accent.shape} stamp={false} className="absolute inset-0 z-[1] h-full w-full" />
        )}
        <span className="font-label relative z-[4] p-3 text-[15px] tracking-[1.2px]">{category.name}</span>
      </button>
      <HandDrawnMark
        id={`cat-${category.id}`}
        kind={mark.kind}
        color={mark.color}
        delay={120 + index * 60}
        className="ce-mark -right-4 -top-4 z-[5] h-24 w-28 rotate-6"
      />
      <HandDrawnMark
        id={`cat-${category.id}-hover`}
        kind="circle-loop"
        color={hoverColor}
        duration={500}
        visible={hovered}
        stretch
        className="ce-mark absolute -inset-4 z-[6] rotate-1"
      />
    </div>
  );
}

function ProductsStep({
  category,
  genderPath,
  products,
}: {
  category: ExplorerCategory;
  genderPath: string;
  products: ProductDisplay[];
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-impact text-2xl uppercase">{category.name}</h3>
        {category.gender !== "UNISEX" && (
          <Link
            href={`/${genderPath}/${category.slug}`}
            prefetch={false}
            className="font-label text-[12px] tracking-[1.4px] text-lime hover:underline"
          >
            View all →
          </Link>
        )}
      </div>
      {products.length > 0 ? (
        <div className="grid grid-cols-2 gap-5 desktop:grid-cols-4">
          {products.map((p, i) => (
            <ProductTile key={p.id} product={p} index={i} />
          ))}
        </div>
      ) : (
        <p className="text-muted">No products in this category yet.</p>
      )}
    </div>
  );
}

function ProductTile({ product, index }: { product: ProductDisplay; index: number }) {
  const mark = pickMark(`explorer-prod-${product.id}`);
  const hoverColor = pickMark(`explorer-hover-prod-${product.id}`, mark.color).color;
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="ce-card relative"
      style={{ animationDelay: `${index * 60}ms` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <HandDrawnMark
        id={`prod-${product.id}`}
        kind={mark.kind}
        color={mark.color}
        delay={100 + index * 70}
        className="ce-mark -right-3 -top-3 z-[7] h-20 w-24 rotate-6"
      />
      <HandDrawnMark
        id={`prod-${product.id}-hover`}
        kind="circle-loop"
        color={hoverColor}
        duration={500}
        visible={hovered}
        stretch
        className="ce-mark absolute -inset-3 z-[8] -rotate-1"
      />
      <ProductCard product={product} />
    </div>
  );
}
