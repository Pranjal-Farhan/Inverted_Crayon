import { requireAdminPage } from "@/lib/admin-guard";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { manufacturerHref, manufacturerLabel } from "@/lib/manufacturer-link";
import { Panel } from "@/components/admin/Panel";
import { StatusBadge } from "@/components/admin/StatusBadge";

type Props = { searchParams: Promise<{ q?: string; gender?: string; category?: string }> };

const COLUMNS = ["Product", "SKU", "Category", "Price", "Stock", "Current vendor", "Tags"];
const SKUS_SHOWN = 3;

export default async function AdminProductsPage({ searchParams }: Props) {
  await requireAdminPage("products");
  const { q, gender, category } = await searchParams;
  const categories = await db.category.findMany({ orderBy: { position: "asc" } });

  const products = await db.product.findMany({
    where: {
      title: q ? { contains: q, mode: "insensitive" } : undefined,
      gender: gender ? (gender as "MEN" | "WOMEN" | "UNISEX") : undefined,
      categoryId: category || undefined,
    },
    include: {
      category: true,
      variants: { select: { sku: true, stockQty: true, lowStockThreshold: true }, orderBy: { sku: "asc" } },
      tags: { include: { tag: true } },
      // Same cover rule as the storefront's ProductCard: first image by position that has a real
      // URL. Legacy inline `data:` rows are skipped — they're multi-hundred-KB Base64 blobs
      // (ARCHITECTURE.md §12) and a hundred of them would balloon this one query.
      images: {
        where: { url: { not: "" }, NOT: { url: { startsWith: "data:" } } },
        orderBy: { position: "asc" },
        take: 1,
        select: { url: true },
      },
      manufacturerLinks: { where: { isCurrentVendor: true }, take: 1, select: { url: true } },
      // Empty-url rows are placeholder slots (accent colour only), not photos — don't count them.
      _count: { select: { images: { where: { url: { not: "" } } }, manufacturerLinks: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <form className="mb-3.5 flex flex-wrap items-center gap-2.5" method="get">
        <input name="q" defaultValue={q} placeholder="Search products…" className="border border-line-2 bg-panel px-2.5 py-2 text-sm outline-none focus:border-lime" />
        <select name="gender" defaultValue={gender ?? ""} className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          <option value="">All genders</option>
          <option value="MEN">Men</option>
          <option value="WOMEN">Women</option>
          <option value="UNISEX">Unisex</option>
        </select>
        <select name="category" defaultValue={category ?? ""} className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="border border-line-2 px-3 py-2 text-sm hover:border-lime">
          Filter
        </button>
        <Link href="/admin/products/new" className="btn-primary ml-auto bg-lime px-4 py-2 font-impact text-sm text-ink">
          + New product
        </Link>
      </form>

      <Panel className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                {COLUMNS.map((h) => (
                  <th key={h} className="font-label px-3 py-2.5 text-[13px] tracking-[0.8px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const editHref = `/admin/products/${p.id}`;
                const cover = p.images[0]?.url;
                const stock = p.variants.reduce((s, v) => s + v.stockQty, 0);
                const lowVariants = p.variants.filter((v) => v.stockQty > 0 && v.stockQty <= v.lowStockThreshold).length;
                const outVariants = p.variants.filter((v) => v.stockQty <= 0).length;
                const skus = p.variants.map((v) => v.sku);
                const vendor = p.manufacturerLinks[0]?.url;
                const vendorHref = vendor ? manufacturerHref(vendor) : null;
                const discount =
                  p.discountType && p.discountValue != null
                    ? p.discountType === "PERCENT"
                      ? `${toNumber(p.discountValue)}% off`
                      : `${formatTaka(toNumber(p.discountValue))} off`
                    : null;

                return (
                  <tr key={p.id} className="border-b border-line hover:bg-panel-2/40">
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3.5">
                        <Link
                          href={editHref}
                          prefetch={false}
                          aria-label={`Edit ${p.title}`}
                          className="relative block h-[72px] w-[72px] shrink-0 overflow-hidden border border-line-2 bg-panel-2"
                        >
                          {cover ? (
                            <Image src={cover} alt="" fill sizes="72px" quality={75} className="object-cover" />
                          ) : (
                            <span className="font-label grid h-full w-full place-items-center text-center text-[10px] leading-tight tracking-[1px] text-muted-2">
                              NO
                              <br />
                              IMAGE
                            </span>
                          )}
                        </Link>
                        <div className="min-w-0">
                          <Link href={editHref} prefetch={false} className="block max-w-[180px] text-[15px] font-medium leading-snug hover:text-lime">
                            {p.title}
                          </Link>
                          <div className="mt-0.5 max-w-[180px] truncate text-[12px] text-muted">/{p.slug}</div>
                          <div className="mt-1 flex items-center gap-2">
                            <StatusBadge status={p.status === "ACTIVE" ? "Active" : "Draft"} />
                            <span className="text-[12px] text-muted-2">
                              {p._count.images} {p._count.images === 1 ? "photo" : "photos"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-3 py-4">
                      {skus.length === 0 ? (
                        <span className="text-muted-2">—</span>
                      ) : (
                        <div className="font-mono text-[12px] leading-relaxed" title={skus.join("\n")}>
                          {skus.slice(0, SKUS_SHOWN).map((sku) => (
                            <div key={sku}>{sku}</div>
                          ))}
                          {skus.length > SKUS_SHOWN && (
                            <div className="text-muted-2">+{skus.length - SKUS_SHOWN} more</div>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-4">
                      <div>{p.category.name}</div>
                      <div className="mt-0.5 text-[12px] text-muted">
                        {p.gender === "MEN" ? "Men" : p.gender === "WOMEN" ? "Women" : "Unisex"}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-3 py-4">
                      <div>{formatTaka(toNumber(p.basePrice))}</div>
                      {discount && <div className="mt-0.5 text-[12px] text-lime">{discount}</div>}
                    </td>

                    <td className="whitespace-nowrap px-3 py-4">
                      <div className={stock === 0 ? "text-error" : undefined}>{stock}</div>
                      <div className="mt-0.5 text-[12px] text-muted">
                        {p.variants.length} {p.variants.length === 1 ? "variant" : "variants"}
                      </div>
                      {(lowVariants > 0 || outVariants > 0) && (
                        <div className="mt-0.5 text-[12px]">
                          {outVariants > 0 && <span className="text-error">{outVariants} out</span>}
                          {outVariants > 0 && lowVariants > 0 && <span className="text-muted-2"> · </span>}
                          {lowVariants > 0 && <span className="text-yellow">{lowVariants} low</span>}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-4">
                      {vendor ? (
                        vendorHref ? (
                          <a
                            href={vendorHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={vendor}
                            className="block max-w-[160px] truncate text-cyan hover:underline"
                          >
                            {manufacturerLabel(vendor)}
                          </a>
                        ) : (
                          <span title={vendor} className="block max-w-[160px] truncate">
                            {manufacturerLabel(vendor)}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-2">{p._count.manufacturerLinks > 0 ? "None tagged" : "—"}</span>
                      )}
                      {p._count.manufacturerLinks > 0 && (
                        <div className="mt-0.5 text-[12px] text-muted-2">
                          {p._count.manufacturerLinks} {p._count.manufacturerLinks === 1 ? "link" : "links"} saved
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-4">
                      {p.tags.length === 0 ? (
                        <span className="text-muted-2">—</span>
                      ) : (
                        <div className="flex max-w-[160px] flex-wrap gap-1">
                          {p.tags.map((t) => (
                            <span key={t.tag.id} className="border border-line-2 px-1.5 py-0.5 text-[11px] text-muted">
                              {t.tag.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-6 text-center text-muted">
                    No products match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
