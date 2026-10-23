"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addStock, getStockHistory, removeStock, setStockTo } from "@/actions/admin-stock";
import { formatTaka } from "@/lib/money";
import type { InventoryProduct, InventoryVariant, StockHistoryRow } from "@/lib/inventory";
import { NETWORK_ERROR } from "@/lib/attempt";

type Msg = { ok: boolean; text: string } | null;
const NETWORK = NETWORK_ERROR;

/**
 * The menu that opens over the Inventory list when a product is clicked: every size and colour with
 * its count and value, a box to add stock to any of them (type a number and press Enter, or tap
 * +1 / +5 / +10), and — under “More” — removing units (with a reason) or a stock-take. Each answer
 * from the server carries the true new count, which is what the screen then shows; any refusal is
 * written out next to the size it concerns.
 */
export function StockOverlay({ product, canSeeCost, onQty, onClose }: { product: InventoryProduct; canSeeCost: boolean; onQty: (variantId: string, qty: number) => void; onClose: () => void }) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);
  const [history, setHistory] = useState<StockHistoryRow[] | null>(null);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    const returnTo = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (returnTo instanceof HTMLElement) returnTo.focus();
    };
  }, [onClose]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await getStockHistory(product.id);
        if (!live) return;
        if (r.ok && r.rows) {
          setHistory(r.rows);
          setHistoryError("");
        } else setHistoryError(r.error || "The history couldn't be loaded.");
      } catch {
        if (live) setHistoryError(NETWORK);
      }
    })();
    return () => {
      live = false;
    };
  }, [product.id, tick]);

  const changed = useCallback(
    (variantId: string, qty: number) => {
      onQty(variantId, qty);
      setTick((t) => t + 1);
    },
    [onQty],
  );

  const units = product.variants.reduce((t, v) => t + v.stock, 0);
  const worth = product.variants.reduce((t, v) => t + v.stock * v.price, 0);
  const cost = product.cost != null ? units * product.cost : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-stretch justify-center bg-black/60 backdrop-blur-[3px] desktop:items-start desktop:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-full w-full max-w-[940px] flex-col overflow-y-auto border border-line-2 border-t-[4px] border-t-lime bg-panel/95 shadow-2xl outline-none backdrop-blur-md"
      >
        <header className="flex items-start gap-3.5 border-b border-line p-4 desktop:p-5">
          <span className="relative block h-[64px] w-[64px] shrink-0 overflow-hidden border border-line-2 bg-panel-2">
            {product.image && <Image src={product.image} alt="" fill sizes="64px" quality={70} className="object-cover" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-impact text-[20px] uppercase leading-tight tracking-[0.5px] desktop:text-[24px]">
              {product.title}
            </h2>
            <p className="mt-0.5 text-[13px] text-muted">
              {product.category} · {product.gender} · {product.active ? "Active" : "Draft"} ·{" "}
              <Link href={`/admin/products/${product.id}`} className="text-cyan hover:underline">
                Edit product →
              </Link>
            </p>
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
              <div>
                <dt className="inline text-muted">Units </dt>
                <dd className="inline font-semibold tabular-nums">{units}</dd>
              </div>
              {canSeeCost && (
                <div>
                  <dt className="inline text-muted">At buying cost </dt>
                  <dd className="inline font-semibold tabular-nums">{cost != null ? formatTaka(cost) : <span className="text-yellow">no cost set</span>}</dd>
                </div>
              )}
              <div>
                <dt className="inline text-muted">Worth when sold </dt>
                <dd className="inline font-semibold tabular-nums">{formatTaka(worth)}</dd>
              </div>
            </dl>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 border border-line-2 px-3 py-1.5 text-sm text-muted hover:border-paper hover:text-paper">
            Close ✕
          </button>
        </header>

        <div className="p-4 desktop:p-5">
          {product.variants.length === 0 ? (
            <p className="border border-line bg-ink/40 px-4 py-6 text-center text-sm text-muted">
              This product has no sizes yet.{" "}
              <Link href={`/admin/products/${product.id}`} className="text-cyan underline">
                Add sizes in the product editor
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2.5">
              {product.variants.map((v) => (
                <VariantLine key={v.id} v={v} cost={product.cost} canSeeCost={canSeeCost} onChanged={changed} />
              ))}
            </ul>
          )}

          <section className="mt-6" aria-label="Recent stock changes">
            <h3 className="font-label mb-2 text-[13px] tracking-[1.2px] text-muted">RECENT STOCK CHANGES</h3>
            {historyError && <p role="alert" className="mb-2 text-[13px] text-error">{historyError}</p>}
            {history == null && !historyError && <p className="text-[13px] text-muted-2">Loading…</p>}
            {history && history.length === 0 && <p className="text-[13px] text-muted-2">No changes recorded yet.</p>}
            {history && history.length > 0 && (
              <div className="max-h-[260px] overflow-auto border border-line">
                <table className="w-full min-w-[640px] text-[12px]">
                  <thead className="sticky top-0 bg-panel-2 text-left text-muted">
                    <tr>
                      {["When", "Size", "Change", "Now", "Why", "By"].map((h) => (
                        <th key={h} className="font-label px-2.5 py-1.5 text-[12px] tracking-[0.8px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((m) => (
                      <tr key={m.id} className="border-t border-line align-top">
                        <td className="whitespace-nowrap px-2.5 py-1.5 text-muted">{new Date(m.at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" })}</td>
                        <td className="px-2.5 py-1.5">{m.variantLabel}</td>
                        <td className={`whitespace-nowrap px-2.5 py-1.5 tabular-nums ${m.delta > 0 ? "text-lime" : m.delta < 0 ? "text-pink" : ""}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                        <td className="px-2.5 py-1.5 tabular-nums">{m.after}</td>
                        <td className="px-2.5 py-1.5">
                          {m.reason}
                          {m.orderNumber ? ` · ${m.orderNumber}` : ""}
                          {m.note && <div className="text-muted-2">{m.note}</div>}
                        </td>
                        <td className="px-2.5 py-1.5 text-muted">{m.by ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function VariantLine({ v, cost, canSeeCost, onChanged }: { v: InventoryVariant; cost: number | null; canSeeCost: boolean; onChanged: (variantId: string, qty: number) => void }) {
  const [add, setAdd] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [more, setMore] = useState<null | "remove" | "set">(null);
  const [removeQty, setRemoveQty] = useState("");
  const [setQty, setSetQty] = useState("");
  const [why, setWhy] = useState("");

  const level = v.stock <= 0 ? "out" : v.stock <= v.low ? "low" : "ok";

  async function run(label: string, action: () => Promise<{ ok: boolean; error: string; qty?: number }>, after?: () => void) {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await action();
      if (!r.ok) setMsg({ ok: false, text: r.error || "That didn't work." });
      else {
        if (r.qty != null) onChanged(v.id, r.qty);
        setMsg({ ok: true, text: `${label}${r.qty != null ? ` — now ${r.qty} in stock` : ""}.` });
        after?.();
      }
    } catch {
      setMsg({ ok: false, text: NETWORK });
    } finally {
      setBusy(false);
    }
  }

  const n = (s: string) => (s.trim() === "" ? NaN : Number(s));

  function doAdd() {
    const qty = n(add);
    if (!Number.isInteger(qty) || qty < 1) return setMsg({ ok: false, text: "Enter how many units to add (a whole number, 1 or more)." });
    run(`Added ${qty}`, () => addStock(v.id, qty), () => setAdd(""));
  }
  function doRemove() {
    const qty = n(removeQty);
    if (!Number.isInteger(qty) || qty < 1) return setMsg({ ok: false, text: "Enter how many units to remove (a whole number, 1 or more)." });
    if (qty > v.stock) return setMsg({ ok: false, text: `Only ${v.stock} in stock — can't remove ${qty}.` });
    run(`Removed ${qty}`, () => removeStock(v.id, qty, why), () => { setRemoveQty(""); setWhy(""); setMore(null); });
  }
  function doSet() {
    const qty = n(setQty);
    if (!Number.isInteger(qty) || qty < 0) return setMsg({ ok: false, text: "Enter the count on the shelf (a whole number, 0 or more)." });
    run(`Count set to ${qty}`, () => setStockTo(v.id, v.stock, qty, why), () => { setSetQty(""); setWhy(""); setMore(null); });
  }

  const bump = (by: number) => setAdd(String((Number.isInteger(n(add)) ? n(add) : 0) + by));
  const input = "border border-line-2 bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-lime disabled:opacity-50";

  return (
    <li className={`border bg-ink/40 p-3 ${level === "out" ? "border-error/40" : level === "low" ? "border-yellow/40" : "border-line"}`}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
        <div className="flex min-w-[170px] items-center gap-2.5">
          <span aria-hidden className="h-4 w-4 shrink-0 rounded-full border border-line-2" style={{ background: v.colorHex ?? "transparent" }} />
          <div>
            <div className="text-[15px] font-medium">
              {v.size} <span className="text-muted">/ {v.color}</span>
            </div>
            <div className="font-mono text-[11px] text-muted-2">{v.sku}</div>
          </div>
        </div>

        <div className="min-w-[96px]">
          <div className={`font-impact text-[26px] leading-none tabular-nums ${level === "out" ? "text-error" : level === "low" ? "text-yellow" : ""}`} aria-label={`${v.stock} in stock`}>
            {v.stock}
          </div>
          <div className="mt-0.5 text-[11px] tracking-[0.6px] text-muted-2">{level === "out" ? "SOLD OUT" : level === "low" ? "LOW STOCK" : "IN STOCK"}</div>
        </div>

        <div className="min-w-[130px] text-[12px] text-muted">
          <div className="tabular-nums">Worth {formatTaka(v.stock * v.price)}</div>
          <div className="text-muted-2 tabular-nums">
            {formatTaka(v.price)} each{canSeeCost && cost != null ? ` · cost ${formatTaka(cost)}` : ""}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <label className="sr-only" htmlFor={`add-${v.id}`}>
            Units to add to {v.size} / {v.color}
          </label>
          <input
            id={`add-${v.id}`}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={add}
            disabled={busy}
            onChange={(e) => setAdd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                doAdd();
              }
            }}
            placeholder="Add units"
            className={`${input} w-[104px] tabular-nums`}
          />
          {[1, 5, 10].map((by) => (
            <button key={by} type="button" disabled={busy} onClick={() => bump(by)} className="border border-line-2 px-2 py-1.5 text-[12px] text-muted hover:border-lime hover:text-paper disabled:opacity-50">
              +{by}
            </button>
          ))}
          <button type="button" disabled={busy} onClick={doAdd} className="btn-primary bg-lime px-3.5 py-1.5 font-impact text-sm text-ink disabled:opacity-50">
            {busy ? "Saving…" : "Add"}
          </button>
          <button type="button" disabled={busy} onClick={() => { setMore((m) => (m ? null : "remove")); setMsg(null); }} aria-expanded={more != null} className="border border-line-2 px-2.5 py-1.5 text-[12px] text-muted hover:border-paper disabled:opacity-50">
            More ▾
          </button>
        </div>
      </div>

      {more && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="mb-2 flex gap-1.5 text-[13px]">
            {([["remove", "Remove units"], ["set", "Stock-take (set exact count)"]] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => { setMore(id); setMsg(null); }} className={`border px-3 py-1 ${more === id ? "border-lime text-lime" : "border-line-2 text-muted hover:border-lime"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2.5">
            {more === "remove" ? (
              <label className="block">
                <span className="font-label mb-1 block text-[11px] tracking-[1px] text-muted">UNITS TO REMOVE</span>
                <input type="number" min={1} step={1} value={removeQty} disabled={busy} onChange={(e) => setRemoveQty(e.target.value)} className={`${input} w-[110px] tabular-nums`} />
              </label>
            ) : (
              <label className="block">
                <span className="font-label mb-1 block text-[11px] tracking-[1px] text-muted">COUNT ON THE SHELF</span>
                <input type="number" min={0} step={1} value={setQty} disabled={busy} onChange={(e) => setSetQty(e.target.value)} className={`${input} w-[130px] tabular-nums`} />
              </label>
            )}
            <label className="block min-w-[220px] flex-1">
              <span className="font-label mb-1 block text-[11px] tracking-[1px] text-muted">{more === "remove" ? "WHY (REQUIRED)" : "NOTE (OPTIONAL)"}</span>
              <input value={why} disabled={busy} onChange={(e) => setWhy(e.target.value)} placeholder={more === "remove" ? "Damaged, lost, miscounted…" : "Counted on the shelf"} className={`${input} w-full`} />
            </label>
            <button type="button" disabled={busy} onClick={more === "remove" ? doRemove : doSet} className="border border-pink px-3.5 py-1.5 text-sm text-pink hover:bg-pink/10 disabled:opacity-50">
              {busy ? "Saving…" : more === "remove" ? "Remove units" : "Set count"}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-muted-2">
            {more === "remove" ? "For units that are not sales — sales take their own stock automatically." : "Refused if someone else changed this size since you opened it, so a stock-take can never overwrite a sale."}
          </p>
        </div>
      )}

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mt-2.5 text-[13px] ${msg.ok ? "text-lime" : "border border-error/40 bg-error/[0.07] px-3 py-2 text-error"}`}>
          {msg.text}
        </p>
      )}
    </li>
  );
}
