import type { Metadata } from "next";
import { db } from "@/lib/db";
import { GENERIC_SIZE_GUIDE, parseSizeGuide } from "@/lib/size-guide";

export const metadata: Metadata = { title: "Size Guide" };

type Props = { searchParams: Promise<{ product?: string }> };

export default async function SizeGuidePage({ searchParams }: Props) {
  const { product: slug } = await searchParams;

  const product = slug ? await db.product.findUnique({ where: { slug }, select: { title: true, sizeGuide: true } }) : null;
  const parsed = product ? parseSizeGuide(product.sizeGuide) : null;
  const table = parsed ?? GENERIC_SIZE_GUIDE;
  const isProductSpecific = Boolean(parsed);

  return (
    <section className="pg pb-16">
      <div className="mx-auto max-w-[760px]">
        <div className="pt-8 pb-1.5 text-center">
          <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">
            Size <span className="text-lime">Guide</span>
          </h1>
          <p className="mx-auto mt-3 max-w-[52ch] text-muted">
            {isProductSpecific ? (
              <>
                Measurements in inches for <span className="text-paper">{product!.title}</span>.
              </>
            ) : slug ? (
              "That product doesn't have measurements entered yet — here's our general reference chart. Oversized fits run 1 size roomy."
            ) : (
              "Measurements in inches. Oversized fits run 1 size roomy."
            )}
          </p>
        </div>
        <div className="doc py-4">
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr>
                <th className="font-label border-b border-line-2 p-2.5 tracking-[1px] text-muted">Size</th>
                {table.columns.map((col) => (
                  <th key={col} className="font-label border-b border-line-2 p-2.5 tracking-[1px] text-muted">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr key={row.size}>
                  <td className="border-b border-line p-2.5">{row.size}</td>
                  {table.columns.map((col, i) => (
                    <td key={col} className="border-b border-line p-2.5">
                      {row.values[i] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
