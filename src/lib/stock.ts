import "server-only";
import { revalidatePath } from "next/cache";
import type { $Enums, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { invalidateProduct } from "@/lib/invalidate";
import { notifyBackInStock } from "@/lib/notifications";
import { UserError } from "@/lib/action-errors";

/**
 * THE ONE PLACE stock changes. Stock is changed from several places now — the website's checkout,
 * order cancellations and refunds, failed payments, recorded sales, the Inventory screen, the
 * product editor — and a number that several things write to is only safe if every write is
 * (1) atomic, (2) guarded against going below zero, and (3) recorded. So:
 *
 *  - changeStock moves a count by a DELTA with a single SQL statement (`stockQty = stockQty ± n`,
 *    guarded by `stockQty >= n` when taking units), never "read the number, then write a number" —
 *    two things changing the same variant at once can't overwrite each other or oversell.
 *  - setStockCount (a stock-take correction) only succeeds if the count is still what the person
 *    saw (`WHERE stockQty = expected`); otherwise it refuses and says what the count is now.
 *  - every change writes a StockMovement row in the same transaction, so a variant's movements
 *    always add up to its stockQty. stockLedgerMismatches() checks exactly that.
 *  - the database itself refuses a negative count (CHECK constraint), as a last line of defence.
 *
 * Nothing else in the codebase may write Variant.stockQty (the only other writer is seed data,
 * which writes its own OPENING movements).
 */

export class StockError extends UserError {}

type Tx = Prisma.TransactionClient;
type Reason = $Enums.StockReason;

export type StockChange = { variantId: string; productId: string; before: number; after: number };

const VARIANT_SELECT = { stockQty: true, sku: true, size: true, color: true, productId: true, product: { select: { title: true } } } as const;

type Context = { reason: Reason; orderId?: string | null; orderNumber?: string | null; note?: string | null; actorEmail?: string | null };

function label(v: { size: string; color: string }) {
  return `${v.size} / ${v.color}`;
}

async function writeMovement(tx: Tx, variantId: string, v: { sku: string; size: string; color: string; product: { title: string } }, delta: number, after: number, ctx: Context) {
  await tx.stockMovement.create({
    data: {
      variantId,
      productTitle: v.product.title,
      variantLabel: label(v),
      sku: v.sku,
      delta,
      qtyAfter: after,
      reason: ctx.reason,
      orderId: ctx.orderId ?? null,
      orderNumber: ctx.orderNumber ?? null,
      note: ctx.note?.trim() || null,
      actorEmail: ctx.actorEmail ?? null,
    },
  });
}

/** Adds (delta > 0) or takes (delta < 0) units, atomically, and records it. Throws StockError if there aren't enough units to take. */
export async function changeStock(tx: Tx, input: Context & { variantId: string; delta: number }): Promise<StockChange> {
  const { variantId, delta } = input;
  if (!Number.isInteger(delta)) throw new StockError("Stock changes must be whole numbers.");

  if (delta === 0) {
    const v = await tx.variant.findUnique({ where: { id: variantId }, select: VARIANT_SELECT });
    if (!v) throw new StockError("That size no longer exists — reload the page.");
    return { variantId, productId: v.productId, before: v.stockQty, after: v.stockQty };
  }

  if (delta > 0) {
    let v;
    try {
      v = await tx.variant.update({ where: { id: variantId }, data: { stockQty: { increment: delta } }, select: VARIANT_SELECT });
    } catch (e) {
      if ((e as { code?: string }).code === "P2025") throw new StockError("That size no longer exists — reload the page.");
      throw e;
    }
    await writeMovement(tx, variantId, v, delta, v.stockQty, input);
    return { variantId, productId: v.productId, before: v.stockQty - delta, after: v.stockQty };
  }

  const taken = await tx.variant.updateMany({ where: { id: variantId, stockQty: { gte: -delta } }, data: { stockQty: { decrement: -delta } } });
  if (taken.count === 0) {
    const v = await tx.variant.findUnique({ where: { id: variantId }, select: VARIANT_SELECT });
    if (!v) throw new StockError("That size no longer exists — reload the page.");
    throw new StockError(
      `Not enough stock for ${v.product.title} (${label(v)}): ${v.stockQty} in stock, ${-delta} needed.`,
    );
  }
  const v = await tx.variant.findUniqueOrThrow({ where: { id: variantId }, select: VARIANT_SELECT });
  await writeMovement(tx, variantId, v, delta, v.stockQty, input);
  return { variantId, productId: v.productId, before: v.stockQty - delta, after: v.stockQty };
}

/**
 * A stock-take: set the count to what is physically on the shelf. `expected` is the count the person
 * was looking at — if anything has changed it since (a sale, another admin), nothing is written and
 * the error says what the count is now, so a stale screen can never overwrite a newer number.
 */
export async function setStockCount(tx: Tx, input: Omit<Context, "reason"> & { variantId: string; expected: number; target: number }): Promise<StockChange> {
  const { variantId, expected, target } = input;
  if (!Number.isInteger(target) || target < 0) throw new StockError("The count must be a whole number, zero or more.");
  const moved = await tx.variant.updateMany({ where: { id: variantId, stockQty: expected }, data: { stockQty: target } });
  if (moved.count === 0) {
    const v = await tx.variant.findUnique({ where: { id: variantId }, select: VARIANT_SELECT });
    if (!v) throw new StockError("That size no longer exists — reload the page.");
    throw new StockError(`The count changed to ${v.stockQty} while you were editing it (you saw ${expected}). Nothing was saved — check the number and try again.`);
  }
  const v = await tx.variant.findUniqueOrThrow({ where: { id: variantId }, select: VARIANT_SELECT });
  if (target !== expected) await writeMovement(tx, variantId, v, target - expected, target, { ...input, reason: "CORRECTION" });
  return { variantId, productId: v.productId, before: expected, after: target };
}

/** A variant that was just created with a starting count: record it as its opening balance. */
export async function recordOpening(tx: Tx, variantId: string, ctx: Omit<Context, "reason"> = {}) {
  const v = await tx.variant.findUnique({ where: { id: variantId }, select: VARIANT_SELECT });
  if (v && v.stockQty > 0) await writeMovement(tx, variantId, v, v.stockQty, v.stockQty, { ...ctx, reason: "OPENING", note: ctx.note ?? "Starting stock when the size was added" });
}

/** Writes the history for variants that are about to be deleted with stock on them (the rows can't be changed after). */
export async function recordRemoval(tx: Tx, variantIds: string[], ctx: Omit<Context, "reason"> = {}) {
  if (variantIds.length === 0) return;
  const variants = await tx.variant.findMany({ where: { id: { in: variantIds }, stockQty: { gt: 0 } }, select: { id: true, ...VARIANT_SELECT } });
  for (const v of variants) await writeMovement(tx, v.id, v, -v.stockQty, 0, { ...ctx, reason: "VARIANT_REMOVED", note: ctx.note ?? "Deleted while it still had stock" });
}

/** Several changes to one variant inside a single transaction count as one: from the first "before" to the last "after". */
export function mergeChanges(changes: StockChange[]): StockChange[] {
  const byVariant = new Map<string, StockChange>();
  for (const c of changes) {
    const seen = byVariant.get(c.variantId);
    byVariant.set(c.variantId, seen ? { ...seen, after: c.after } : { ...c });
  }
  return [...byVariant.values()];
}

/**
 * Run AFTER the transaction has committed (never inside it): refreshes what depends on stock — the
 * storefront's sold-out / preorder badges, the admin screens — and sends the back-in-stock emails
 * for a size that went from none to some, whichever screen or order caused it. Failures here are
 * logged and swallowed: the stock change itself is already safely saved.
 */
export async function afterStockChanged(changes: StockChange[]) {
  const merged = mergeChanges(changes).filter((c) => c.before !== c.after);
  if (merged.length === 0) return;
  try {
    const products = await db.product.findMany({ where: { id: { in: [...new Set(merged.map((c) => c.productId))] } }, select: { id: true, slug: true } });
    for (const p of products) invalidateProduct({ id: p.id, slug: p.slug });
    revalidatePath("/admin/inventory");
    revalidatePath("/admin/products");
  } catch (e) {
    console.error("[stock] refresh after stock change failed", e);
  }
  for (const c of merged) {
    try {
      if (c.before === 0 && c.after > 0) await notifyRestocked(c.variantId);
      else if (c.before > 0 && c.after === 0) await resetWishlistIfSoldOut(c.productId);
    } catch (e) {
      console.error("[stock] back-in-stock handling failed", e);
    }
  }
}

async function notifyRestocked(variantId: string) {
  const v = await db.variant.findUnique({ where: { id: variantId }, include: { product: true } });
  if (!v) return;
  const variantLabel = label(v);
  const subs = await db.backInStockSubscription.findMany({ where: { variantId, notifiedAt: null } });
  const subscriberEmails = new Set(subs.map((s) => s.email.toLowerCase()));
  for (const sub of subs) await notifyBackInStock({ to: sub.email, productName: v.product.title, productSlug: v.product.slug, variantLabel });
  if (subs.length > 0) await db.backInStockSubscription.updateMany({ where: { variantId, notifiedAt: null }, data: { notifiedAt: new Date() } });

  // Wishlists are per product, not per size: anyone who saved the product hears about it too —
  // unless they were just emailed above, or were already told since it last sold out entirely.
  const wishlisters = await db.wishlistItem.findMany({ where: { productId: v.productId, notifiedAt: null }, include: { customer: true } });
  const toNotify = wishlisters.filter((w) => !subscriberEmails.has(w.customer.email.toLowerCase()));
  for (const w of toNotify) await notifyBackInStock({ to: w.customer.email, productName: v.product.title, productSlug: v.product.slug, variantLabel });
  if (toNotify.length > 0) await db.wishlistItem.updateMany({ where: { id: { in: toNotify.map((w) => w.id) } }, data: { notifiedAt: new Date() } });
}

async function resetWishlistIfSoldOut(productId: string) {
  const remaining = await db.variant.aggregate({ where: { productId }, _sum: { stockQty: true } });
  // Fully sold out again — clear the notified flag so a future restock re-notifies wishlisters.
  if ((remaining._sum.stockQty ?? 0) === 0) await db.wishlistItem.updateMany({ where: { productId }, data: { notifiedAt: null } });
}

// ------------------------------------------------------------------------------ integrity

export type LedgerMismatch = { variantId: string; productTitle: string; variantLabel: string; sku: string; stockQty: number; ledger: number };

/** Variants whose stock count is not the sum of their recorded movements — should always be empty. */
export async function stockLedgerMismatches(): Promise<LedgerMismatch[]> {
  const rows = await db.$queryRaw<{ id: string; title: string; size: string; color: string; sku: string; stockQty: number; ledger: number }[]>`
    SELECT v."id", p."title", v."size", v."color", v."sku", v."stockQty",
           COALESCE(SUM(m."delta"), 0)::int AS "ledger"
    FROM "Variant" v
    JOIN "Product" p ON p."id" = v."productId"
    LEFT JOIN "StockMovement" m ON m."variantId" = v."id"
    GROUP BY v."id", p."title"
    HAVING v."stockQty" <> COALESCE(SUM(m."delta"), 0)
    ORDER BY p."title", v."size", v."color"`;
  return rows.map((r) => ({ variantId: r.id, productTitle: r.title, variantLabel: `${r.size} / ${r.color}`, sku: r.sku, stockQty: r.stockQty, ledger: r.ledger }));
}

/** Writes a CORRECTION movement for each mismatched variant so its history adds up again. The stock counts themselves are not touched. */
export async function reconcileStockLedger(actorEmail: string): Promise<number> {
  const mismatches = await stockLedgerMismatches();
  if (mismatches.length === 0) return 0;
  await db.$transaction(async (tx) => {
    for (const m of mismatches) {
      await tx.stockMovement.create({
        data: {
          variantId: m.variantId,
          productTitle: m.productTitle,
          variantLabel: m.variantLabel,
          sku: m.sku,
          delta: m.stockQty - m.ledger,
          qtyAfter: m.stockQty,
          reason: "CORRECTION",
          note: "History reconciled to the current stock count",
          actorEmail,
        },
      });
    }
  });
  return mismatches.length;
}
