import Link from "next/link";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { Panel } from "@/components/admin/Panel";
import { StatusBadge } from "@/components/admin/StatusBadge";

type Props = { searchParams: Promise<{ q?: string; gender?: string; category?: string }> };

export default async function AdminProductsPage({ searchParams }: Props) {
  const { q, gender, category } = await searchParams;
  const categories = await db.category.findMany({ orderBy: { position: "asc" } });

  const products = await db.product.findMany({
    where: {
      title: q ? { contains: q, mode: "insensitive" } : undefined,
      gender: gender ? (gender as "MEN" | "WOMEN" | "UNISEX") : undefined,
      categoryId: category || undefined,
    },
    include: { category: true, variants: true, tags: { include: { tag: true } } },
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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-2 text-left text-muted">
              {["Product", "Gender", "Category", "Price", "Stock", "Tags", "Status"].map((h) => (
                <th key={h} className="font-label px-4 py-2.5 text-[13px] tracking-[0.8px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const stock = p.variants.reduce((s, v) => s + v.stockQty, 0);
              const tags = p.tags.map((t) => t.tag.label).join(", ") || "—";
              return (
                <tr key={p.id} className="border-b border-line">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/products/${p.id}`} className="hover:text-lime">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{p.gender === "MEN" ? "Men" : p.gender === "WOMEN" ? "Women" : "Unisex"}</td>
                  <td className="px-4 py-2.5">{p.category.name}</td>
                  <td className="px-4 py-2.5">{formatTaka(toNumber(p.basePrice))}</td>
                  <td className="px-4 py-2.5">{stock}</td>
                  <td className="px-4 py-2.5">{tags}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={p.status === "ACTIVE" ? "Active" : "Draft"} />
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  No products match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
