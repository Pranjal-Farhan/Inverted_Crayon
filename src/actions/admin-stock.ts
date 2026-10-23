"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdminArea } from "@/lib/admin-guard";
import { afterStockChanged, changeStock, reconcileStockLedger, setStockCount, type StockChange } from "@/lib/stock";
import { fail, guarded, UserError, type Result } from "@/lib/action-errors";
import { loadStockHistory, type StockHistoryRow } from "@/lib/inventory";

/**
 * Stock edits from the Inventory screen and the product editor's stepper. Every one is a change by
 * a DELTA (or a guarded stock-take) through src/lib/stock.ts — never "write this absolute number" —
 * so two people, or a sale landing at the same moment, can't overwrite each other. Each answers
 * { ok, error, qty }: `qty` is the true count afterwards, which the screen shows instead of
 * assuming its own arithmetic.
 */

export type StockResult = Result & { qty?: number };

const MAX_UNITS = 1_000_000;

function whole(n: unknown, what: string): number {
  const v = Number(n);
  if (!Number.isFinite(v) || !Number.isInteger(v)) throw new UserError(`${what} must be a whole number.`);
  return v;
}

async function requireInventory() {
  return requireAdminArea("inventory");
}

/** Adds units to a size — the everyday "a delivery came in" action. */
export async function addStock(variantId: string, quantity: number, note?: string): Promise<StockResult> {
  return guarded("addStock", async () => {
    const admin = await requireInventory();
    const qty = whole(quantity, "The quantity");
    if (qty < 1) return fail("Enter how many units to add (1 or more).");
    if (qty > MAX_UNITS) return fail("That quantity is too large.");
    let change!: StockChange;
    await db.$transaction(async (tx) => {
      change = await changeStock(tx, { variantId, delta: qty, reason: "RESTOCK", note, actorEmail: admin.email });
    });
    await afterStockChanged([change]);
    return { ok: true, error: "", qty: change.after };
  });
}

/** Takes units off a size for a reason that isn't a sale (damaged, lost, a miscount). A note is required so the history says why. */
export async function removeStock(variantId: string, quantity: number, note: string): Promise<StockResult> {
  return guarded("removeStock", async () => {
    const admin = await requireInventory();
    const qty = whole(quantity, "The quantity");
    if (qty < 1) return fail("Enter how many units to remove (1 or more).");
    if (!note?.trim()) return fail("Say why the units are being removed (damaged, lost, miscounted…) so the history explains it.");
    let change!: StockChange;
    await db.$transaction(async (tx) => {
      change = await changeStock(tx, { variantId, delta: -qty, reason: "CORRECTION", note, actorEmail: admin.email });
    });
    await afterStockChanged([change]);
    return { ok: true, error: "", qty: change.after };
  });
}

/** A stock-take: set a size's count to what is on the shelf. Refused if the count changed since it was read. */
export async function setStockTo(variantId: string, expectedQty: number, newQty: number, note?: string): Promise<StockResult> {
  return guarded("setStockTo", async () => {
    const admin = await requireInventory();
    const expected = whole(expectedQty, "The count you saw");
    const target = whole(newQty, "The new count");
    if (target < 0) return fail("The count can't be below zero.");
    if (target > MAX_UNITS) return fail("That count is too large.");
    let change!: StockChange;
    await db.$transaction(async (tx) => {
      change = await setStockCount(tx, { variantId, expected, target, note, actorEmail: admin.email });
    });
    await afterStockChanged([change]);
    return { ok: true, error: "", qty: change.after };
  });
}

/** Admin only: writes a correcting entry for any variant whose history no longer adds up to its count. */
export async function reconcileLedger(): Promise<Result & { fixed?: number }> {
  return guarded("reconcileLedger", async () => {
    const admin = await requireAdminArea("finance");
    const fixed = await reconcileStockLedger(admin.email);
    revalidatePath("/admin/inventory");
    return { ok: true, error: "", fixed };
  });
}

/** The recent stock movements of one product, for the Inventory screen's detail view. */
export async function getStockHistory(productId: string): Promise<Result & { rows?: StockHistoryRow[] }> {
  return guarded("getStockHistory", async () => {
    await requireInventory();
    return { ok: true, error: "", rows: await loadStockHistory(productId) };
  });
}
