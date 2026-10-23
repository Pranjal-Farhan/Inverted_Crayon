"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteRecordedSales, setOrdersExcludedFromFinance } from "@/actions/admin-sales";
import { Panel } from "@/components/admin/Panel";
import { RecordSaleForm } from "@/components/admin/RecordSaleForm";
import type { VariantOption } from "@/lib/variant-options";
import { BulkBar, RowCheck, useSelection } from "./selection";
import { Money, EmptyRow, SaleStatusChip } from "./ui-client";

export type SaleListRow = {
  key: string;
  source: "ONLINE" | "RECORDED";
  id: string;
  ref: string;
  href: string;
  date: string;
  customerName: string;
  customerPhone: string | null;
  lines: { title: string; variant: string; sku: string; qty: number; unitPrice: number }[];
  status: string;
  statusLabel: string;
  counted: boolean;
  paymentLabel: string;
  revenue: number;
  cogs: number;
  profit: number;
  unknownCostUnits: number;
  /** An order taken out of the finance reports. */
  removed: boolean;
};

/**
 * The Sales page's list: every sale as a row with the mandatory facts — date, order number, customer,
 * what was bought, status, payment, total, buying cost, profit. Clicking a row opens that order with
 * its full details under Orders. The checkbox column (which doesn't open anything) is for the bulk
 * actions: take orders out of the finance reports, or delete recorded sales.
 */
export function SalesManager({ rows, variants, today }: { rows: SaleListRow[]; variants: VariantOption[]; today: string }) {
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const [recordedId, setRecordedId] = useState("");
  const sel = useSelection(rows.map((r) => r.key));
  const chosen = rows.filter((r) => sel.has(r.key));
  const chosenRecorded = chosen.filter((r) => r.source === "RECORDED" && !r.removed);
  const chosenToRemove = chosen.filter((r) => !r.removed);
  const chosenRemoved = chosen.filter((r) => r.removed);
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <div>
      <details className="mb-4.5 border border-line bg-panel" open>
        <summary className="font-impact cursor-pointer select-none px-4.5 py-3.5 text-[17px] uppercase tracking-[0.5px]">Record a sale made outside the website</summary>
        <div className="border-t border-line p-4.5">
          {recordedId && (
            <p role="status" className="mb-3 border border-lime/40 bg-lime/[0.07] px-3.5 py-2.5 text-sm text-lime">
              Sale recorded — its stock has been taken off the shelf.{" "}
              <Link href={`/admin/orders/${recordedId}`} className="underline">
                Open the order →
              </Link>
            </p>
          )}
          <RecordSaleForm
            key={formKey}
            variants={variants}
            today={today}
            onDone={(orderId) => {
              setRecordedId(orderId);
              setFormKey((k) => k + 1);
              router.refresh();
            }}
          />
        </div>
      </details>

      <BulkBar
        count={sel.count}
        onClear={sel.clear}
        actions={[
          ...(chosenRecorded.length
            ? [
                {
                  label: `Delete ${plural(chosenRecorded.length, "recorded sale")}`,
                  confirmText: `Permanently delete ${plural(chosenRecorded.length, "recorded sale")}? Any stock they still hold is put back on the shelf. This can't be undone.`,
                  run: () => deleteRecordedSales(chosenRecorded.map((r) => r.id)),
                },
              ]
            : []),
          ...(chosenToRemove.length
            ? [
                {
                  label: `Remove ${plural(chosenToRemove.length, "order")} from finance`,
                  confirmText: `Take ${plural(chosenToRemove.length, "order")} out of every finance report? The orders themselves are not touched, and you can restore them later.`,
                  run: () => setOrdersExcludedFromFinance(chosenToRemove.map((r) => r.id), true),
                },
              ]
            : []),
          ...(chosenRemoved.length
            ? [
                {
                  label: `Restore ${plural(chosenRemoved.length, "order")} to finance`,
                  confirmText: `Put ${plural(chosenRemoved.length, "order")} back into the finance reports?`,
                  run: () => setOrdersExcludedFromFinance(chosenRemoved.map((r) => r.id), false),
                  danger: false,
                },
              ]
            : []),
        ]}
      />

      <Panel className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                <th className="w-9 px-3 py-2.5">
                  <RowCheck checked={sel.allTicked} onChange={sel.toggleAll} label="Select all sales" />
                </th>
                {["Date", "Order", "Customer", "Products", "Status", "Payment", "Total", "Buying cost", "Profit"].map((h) => (
                  <th key={h} className={`font-label px-3 py-2.5 text-[13px] tracking-[0.8px] ${["Total", "Buying cost", "Profit"].includes(h) ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  id={r.id}
                  onClick={() => router.push(r.href)}
                  className={`cursor-pointer border-b border-line align-top hover:bg-panel-2 ${r.removed ? "opacity-60" : ""}`}
                >
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <RowCheck checked={sel.has(r.key)} onChange={() => sel.toggle(r.key)} label={`Select ${r.ref}`} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{r.date}</td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <Link href={r.href} prefetch={false} className="text-cyan hover:underline" onClick={(e) => e.stopPropagation()}>
                      {r.ref}
                    </Link>
                    <div className="text-[11px] tracking-[0.8px] text-muted-2">{r.source === "ONLINE" ? "ONLINE ORDER" : "RECORDED SALE"}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div>{r.customerName}</div>
                    {r.customerPhone && <div className="text-[12px] text-muted">{r.customerPhone}</div>}
                  </td>
                  <td className="max-w-[250px] px-3 py-3 text-[12px] text-muted">
                    {r.lines.length === 0 ? (
                      "—"
                    ) : (
                      <ul className="space-y-0.5">
                        {r.lines.map((l, i) => (
                          <li key={i}>
                            {l.qty}× {l.title}
                            {l.variant && <span> ({l.variant})</span>}
                            {l.sku && <span className="text-muted-2"> · {l.sku}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <SaleStatusChip status={r.status} label={r.statusLabel} />
                    {r.removed ? (
                      <div className="mt-0.5 text-[11px] text-muted-2">left out of finance</div>
                    ) : !r.counted && !["CANCELLED", "REFUNDED", "RETURNED"].includes(r.status) ? (
                      <div className="mt-0.5 text-[11px] text-muted-2">not counted yet</div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted">{r.paymentLabel}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <Money value={r.revenue} tone="plain" />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right text-muted">
                    {r.counted && !r.removed ? <Money value={r.cogs} tone="plain" /> : "—"}
                    {r.counted && !r.removed && r.unknownCostUnits > 0 && (
                      <div className="text-[11px] text-yellow" title="Some items have no purchase cost, so this profit is overstated">
                        {r.unknownCostUnits} unit{r.unknownCostUnits === 1 ? "" : "s"} no cost
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{r.counted && !r.removed ? <Money value={r.profit} /> : <span className="text-muted-2">—</span>}</td>
                </tr>
              ))}
              {rows.length === 0 && <EmptyRow cols={10}>No sales match. Orders from the website appear here automatically; record other sales above.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
