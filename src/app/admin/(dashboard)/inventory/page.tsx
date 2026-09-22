import { db } from "@/lib/db";
import { Panel } from "@/components/admin/Panel";
import { StockCell } from "@/components/admin/StockCell";

type Props = { searchParams: Promise<{ q?: string; low?: string }> };

export default async function AdminInventoryPage({ searchParams }: Props) {
  const { q, low } = await searchParams;

  const variants = await db.variant.findMany({
    where: {
      OR: q
        ? [{ sku: { contains: q, mode: "insensitive" } }, { product: { title: { contains: q, mode: "insensitive" } } }]
        : undefined,
    },
    include: { product: true },
    orderBy: { sku: "asc" },
    take: 200,
  });
  const filtered = low === "1" ? variants.filter((v) => v.stockQty <= v.lowStockThreshold) : variants;

  return (
    <div>
      <form className="mb-3.5 flex flex-wrap items-center gap-2.5" method="get">
        <input name="q" defaultValue={q} placeholder="Search SKU or product…" className="border border-line-2 bg-panel px-2.5 py-2 text-sm outline-none focus:border-lime" />
        <select name="low" defaultValue={low ?? ""} className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          <option value="">All</option>
          <option value="1">Low stock</option>
        </select>
        <button type="submit" className="border border-line-2 px-3 py-2 text-sm hover:border-lime">
          Filter
        </button>
      </form>

      <Panel className="!p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-2 text-left text-muted">
              {["SKU", "Product", "Variant", "In stock", "Threshold", "Status"].map((h) => (
                <th key={h} className="font-label px-4 py-2.5 text-[13px] tracking-[0.8px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((v) => {
              const state = v.stockQty === 0 ? "Out" : v.stockQty <= v.lowStockThreshold ? "Low" : "OK";
              return (
                <tr key={v.id} className="border-b border-line">
                  <td className="px-4 py-2.5">{v.sku}</td>
                  <td className="px-4 py-2.5">{v.product.title}</td>
                  <td className="px-4 py-2.5">
                    {v.size} / {v.color}
                  </td>
                  <td className="px-4 py-2.5">
                    <StockCell variantId={v.id} stockQty={v.stockQty} />
                  </td>
                  <td className="px-4 py-2.5">{v.lowStockThreshold}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`font-label px-2.5 py-0.5 text-[12px] tracking-[0.8px] ${
                        state === "Out" ? "bg-error/[0.16] text-error" : state === "Low" ? "bg-yellow/[0.16] text-yellow" : "bg-lime/[0.16] text-lime"
                      }`}
                    >
                      {state}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No variants match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
