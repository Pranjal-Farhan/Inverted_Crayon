import type { Metadata } from "next";

export const metadata: Metadata = { title: "Size Guide" };

const ROWS = [
  ["S", 40, 27, 8],
  ["M", 42, 28, 8.5],
  ["L", 44, 29, 9],
  ["XL", 46, 30, 9.5],
  ["XXL", 48, 31, 10],
];

export default function SizeGuidePage() {
  return (
    <section className="pg pb-16">
      <div className="pt-8 pb-1.5">
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">
          Size <span className="text-lime">Guide</span>
        </h1>
        <p className="mt-3 max-w-[52ch] text-muted">Measurements in inches. Oversized fits run 1 size roomy.</p>
      </div>
      <div className="doc max-w-[760px] py-4">
        <table className="w-full border-collapse text-center text-sm">
          <thead>
            <tr>
              {["Size", "Chest", "Length", "Sleeve"].map((h) => (
                <th key={h} className="font-label border-b border-line-2 p-2.5 tracking-[1px] text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r[0]}>
                {r.map((cell, i) => (
                  <td key={i} className="border-b border-line p-2.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
