import type { SizeGuideData } from "@/lib/size-guide";

/** Plain read-only rendering of a size guide — shared by the static page shell (the server-
 * rendered generic chart, also the Suspense fallback) and SizeGuideClient.tsx (the product-
 * specific swap) so the two never drift out of sync visually. */
export function SizeGuideReadTable({ table }: { table: SizeGuideData }) {
  return (
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
  );
}
