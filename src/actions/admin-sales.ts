"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminForArea } from "@/lib/admin-guard";
import { entryDate, todayDhaka } from "@/lib/finance-dates";
import { afterStockChanged, changeStock, type StockChange } from "@/lib/stock";
import { fail, guarded, OK, UserError, type Result } from "@/lib/action-errors";

/**
 * Sales recorded by hand (Instagram, in person…). A recorded sale is a real Order with
 * source = RECORDED: it has the same statuses, shows under Orders, and its stock moves through the
 * same stock module as a website order — taken when it is recorded, put back if it is cancelled,
 * refunded, edited down or deleted. Only catalogue products can be sold this way, so the stock and
 * the buying cost are always known.
 */

const METHODS = ["CASH", "BKASH", "BANK", "CARD", "OTHER"] as const;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.");
const money = (label: string) =>
  z.coerce.number({ error: `${label} must be a number.` }).finite().min(0, `${label} can't be negative.`).max(1_000_000_000, `${label} is too large.`);
const text = (max: number) => z.string().trim().max(max);

const itemSchema = z.object({
  variantId: z.string().min(1, "Choose a product for every line."),
  qty: z.coerce.number({ error: "Quantity must be a number." }).int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(100_000),
  unitPrice: money("Price"),
});

const saleSchema = z.object({
  id: z.string().optional(),
  date: day,
  customerName: text(120).min(1, "Enter the customer's name."),
  customerPhone: text(40),
  customerEmail: text(160).refine((v) => v === "" || /^\S+@\S+\.\S+$/.test(v), "That email address doesn't look right."),
  customerAddress: text(300),
  method: z.enum(METHODS, { error: "Pick how it was paid." }),
  // Where the sale starts. Only used when recording a new one — an existing sale's status moves from its Orders page.
  status: z.enum(["PENDING", "SHIPPED", "DELIVERED"], { error: "Pick the sale's status." }),
  paymentReceived: z.boolean(),
  discount: money("Discount"),
  deliveryCharge: money("Delivery charge"),
  notes: text(500),
  items: z.array(itemSchema).min(1, "Add at least one product."),
});

const ACTIVE_STATUSES = ["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
const round2 = (n: number) => Math.round(n * 100) / 100;

async function requireFinance() {
  const admin = await getAdminForArea("finance");
  if (!admin) throw new UserError("Not authorized — recording and editing sales is for admin accounts.");
  return admin;
}

function refresh(orderId?: string) {
  revalidatePath("/admin/finance", "layout");
  revalidatePath("/admin/orders");
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/inventory");
}

function newSaleNumber(): string {
  return `MS-${todayDhaka().replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/** The units this order holds off the shelf, per variant (preorder lines and lines without a variant took none). */
function heldUnits(items: { variantId: string | null; qty: number; isPreorder: boolean }[]) {
  const held = new Map<string, number>();
  for (const i of items) if (i.variantId && !i.isPreorder) held.set(i.variantId, (held.get(i.variantId) ?? 0) + i.qty);
  return held;
}

export async function saveRecordedSale(_prev: Result | null, formData: FormData): Promise<Result & { orderId?: string }> {
  return guarded("saveRecordedSale", async () => {
    const admin = await requireFinance();

    let items: unknown;
    try {
      items = JSON.parse(String(formData.get("items") ?? "[]"));
    } catch {
      return fail("The products couldn't be read — reload the page and try again.");
    }
    const parsed = saleSchema.safeParse({
      id: formData.get("id") || undefined,
      date: formData.get("date"),
      customerName: formData.get("customerName") ?? "",
      customerPhone: formData.get("customerPhone") ?? "",
      customerEmail: formData.get("customerEmail") ?? "",
      customerAddress: formData.get("customerAddress") ?? "",
      method: formData.get("method"),
      status: formData.get("status") || "DELIVERED",
      paymentReceived: formData.get("paymentReceived") === "on",
      discount: formData.get("discount") || 0,
      deliveryCharge: formData.get("deliveryCharge") || 0,
      notes: formData.get("notes") ?? "",
      items,
    });
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form and try again.");
    const d = parsed.data;

    // The same product on two lines is one line for stock purposes; each keeps its own price.
    const wanted = new Map<string, number>();
    for (const i of d.items) wanted.set(i.variantId, (wanted.get(i.variantId) ?? 0) + i.qty);

    const variants = await db.variant.findMany({
      where: { id: { in: [...wanted.keys()] } },
      select: { id: true, sku: true, size: true, color: true, productId: true, product: { select: { id: true, title: true } } },
    });
    if (variants.length !== wanted.size) return fail("One of the products no longer exists — remove that line and try again.");
    const variantById = new Map(variants.map((v) => [v.id, v]));

    const subtotal = round2(d.items.reduce((s, i) => s + i.qty * i.unitPrice, 0));
    if (d.discount > subtotal) return fail("The discount can't be more than the products come to.");
    const total = round2(subtotal - d.discount + d.deliveryCharge);

    const changes: StockChange[] = [];
    let orderId = d.id ?? "";

    await db.$transaction(async (tx) => {
      const lines = d.items.map((i) => {
        const v = variantById.get(i.variantId)!;
        return {
          productId: v.productId,
          variantId: v.id,
          productTitleSnapshot: v.product.title,
          variantLabelSnapshot: `${v.size} / ${v.color}`,
          qty: i.qty,
          unitPrice: i.unitPrice,
          lineTotal: round2(i.qty * i.unitPrice),
        };
      });
      const common = {
        subtotal,
        shippingCost: d.deliveryCharge,
        discountAmount: d.discount,
        total,
        email: d.customerEmail,
        phone: d.customerPhone,
        shippingFullName: d.customerName,
        shippingPhone: d.customerPhone,
        shippingLine1: d.customerAddress,
        internalNotes: d.notes || null,
        recordedMethod: d.method,
      };
      const when = entryDate(d.date);

      if (d.id) {
        const existing = await tx.order.findUnique({ where: { id: d.id }, include: { items: true } });
        if (!existing || existing.source !== "RECORDED") throw new UserError("That sale no longer exists.");
        if (!(ACTIVE_STATUSES as readonly string[]).includes(existing.status)) {
          throw new UserError("This sale was cancelled, refunded or returned, so it can't be edited. Record a new sale instead.");
        }
        // Net stock change per size: what the edited sale holds minus what it held before.
        const before = heldUnits(existing.items);
        const after = new Map(wanted);
        const touched = new Set([...before.keys(), ...after.keys()]);
        // Units coming back first, then units going out — all inside this one transaction, so any refusal undoes everything.
        for (const id of touched) {
          const give = (before.get(id) ?? 0) - (after.get(id) ?? 0);
          if (give > 0) changes.push(await changeStock(tx, { variantId: id, delta: give, reason: "ORDER_RESTORED", orderId: d.id, orderNumber: existing.number, note: "Recorded sale edited", actorEmail: admin.email }));
        }
        for (const id of touched) {
          const take = (after.get(id) ?? 0) - (before.get(id) ?? 0);
          if (take > 0) changes.push(await changeStock(tx, { variantId: id, delta: -take, reason: "ORDER_PLACED", orderId: d.id, orderNumber: existing.number, note: "Recorded sale edited", actorEmail: admin.email }));
        }
        await tx.orderItem.deleteMany({ where: { orderId: d.id } });
        await tx.order.update({
          where: { id: d.id },
          data: {
            ...common,
            createdAt: when,
            // A sale that is already delivered keeps its delivery day in step with its sale date.
            ...(existing.status === "DELIVERED" ? { deliveredAt: when } : {}),
            paymentStatus: d.paymentReceived ? "PAID" : "PENDING",
            cashCollectedAt: d.paymentReceived ? when : null,
            items: { create: lines },
          },
        });
        return;
      }

      let number = "";
      for (let attempt = 0; attempt < 8 && !number; attempt++) {
        const candidate = newSaleNumber();
        if (!(await tx.order.findUnique({ where: { number: candidate }, select: { id: true } }))) number = candidate;
      }
      if (!number) throw new UserError("Couldn't make a sale number — try again.");

      const created = await tx.order.create({
        data: {
          ...common,
          number,
          source: "RECORDED",
          recordedBy: admin.email,
          status: d.status,
          paymentMethod: "COD", // placeholder: the real method is recordedMethod
          paymentStatus: d.paymentReceived ? "PAID" : "PENDING",
          shippingZone: "INSIDE_DHAKA",
          shippingArea: "",
          shippingDistrict: "",
          shippingPostcode: "",
          createdAt: when,
          deliveredAt: d.status === "DELIVERED" ? when : null,
          cashCollectedAt: d.paymentReceived ? when : null,
          items: { create: lines },
        },
      });
      orderId = created.id;
      for (const [variantId, qty] of wanted) {
        changes.push(await changeStock(tx, { variantId, delta: -qty, reason: "ORDER_PLACED", orderId: created.id, orderNumber: number, note: "Recorded sale", actorEmail: admin.email }));
      }
    });

    await afterStockChanged(changes);
    refresh(orderId);
    return { ok: true, error: "", orderId };
  });
}

/** Deletes recorded sales, putting back the stock of any that still held it. Each is handled on its own; refusals are reported by name. */
export async function deleteRecordedSales(ids: string[]): Promise<Result> {
  return guarded("deleteRecordedSales", async () => {
    const admin = await requireFinance();
    const changes: StockChange[] = [];
    const problems: string[] = [];
    let deleted = 0;
    for (const id of ids) {
      try {
        await db.$transaction(async (tx) => {
          const order = await tx.order.findUnique({ where: { id }, include: { items: true } });
          if (!order) return; // already gone: deleting is idempotent
          if (order.source !== "RECORDED") throw new UserError("Only recorded sales can be deleted here — website orders are kept (cancel or refund them from Orders).");
          // Only a sale that still holds its stock gives it back: cancelled and refunded ones already did.
          if ((ACTIVE_STATUSES as readonly string[]).includes(order.status)) {
            for (const [variantId, qty] of heldUnits(order.items)) {
              changes.push(await changeStock(tx, { variantId, delta: qty, reason: "ORDER_RESTORED", orderId: id, orderNumber: order.number, note: "Recorded sale deleted", actorEmail: admin.email }));
            }
          }
          await tx.order.delete({ where: { id } });
        });
        deleted += 1;
      } catch (e) {
        if (e instanceof UserError) problems.push(e.message);
        else throw e;
      }
    }
    await afterStockChanged(changes);
    refresh();
    if (problems.length === 0) return OK;
    return fail(`${deleted ? `Deleted ${deleted}. ` : ""}${problems.join(" ")}`);
  });
}

export async function deleteRecordedSale(id: string): Promise<Result> {
  return deleteRecordedSales([id]);
}

/**
 * Takes website orders out of (or puts them back into) every finance report. The order itself —
 * its page, the customer's view, the stock — is untouched; only the money figures change.
 */
export async function setOrdersExcludedFromFinance(ids: string[], excluded: boolean): Promise<Result> {
  return guarded("setOrdersExcludedFromFinance", async () => {
    await requireFinance();
    const found = await db.order.updateMany({ where: { id: { in: ids } }, data: { excludeFromFinance: excluded } });
    if (found.count === 0) return fail("Those orders no longer exist — reload the page.");
    refresh();
    return OK;
  });
}
