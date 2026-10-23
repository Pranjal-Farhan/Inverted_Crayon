"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminForArea } from "@/lib/admin-guard";
import { entryDate } from "@/lib/finance-dates";
import { fail, guarded, OK, UserError, type Result } from "@/lib/action-errors";

/**
 * Finance → Expenses: expenses, the categories they are filed under, and the owners who pay them.
 * (Recorded sales and the "remove from finance" switch live in admin-sales.ts; stock in
 * admin-stock.ts.) Every action answers { ok, error } and never throws — the screen shows the reason.
 */

/** Every finance page reads from the same tables, so any change refreshes the whole section. */
const refresh = () => revalidatePath("/admin/finance", "layout");

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.");
const money = (label: string) =>
  z.coerce.number({ error: `${label} must be a number.` }).finite().min(0, `${label} can't be negative.`).max(1_000_000_000, `${label} is too large.`);
const methodSchema = z.enum(["CASH", "BKASH", "BANK", "CARD", "OTHER"], { error: "Pick how it was paid." });
const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) => text(max).transform((v) => v || null);

async function requireFinance() {
  const admin = await getAdminForArea("finance");
  if (!admin) throw new UserError("Not authorized — Finance is for admin accounts.");
  return admin;
}

// ================================================================================ expenses

const expenseSchema = z.object({
  id: z.string().optional(),
  date: day,
  amount: money("Amount").refine((n) => n > 0, "Amount must be more than zero."),
  categoryId: z.string().min(1, "Choose a category — create one first (top right) if the list is empty."),
  title: text(140).min(1, "Say what it was for."),
  paidTo: optional(120),
  method: methodSchema,
  // The owner who made the payment — blank for "not recorded" / paid from the business account.
  ownerId: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().nullable()),
  notes: optional(500),
});

export async function saveExpense(_prev: Result | null, formData: FormData): Promise<Result> {
  return guarded("saveExpense", async () => {
    const admin = await requireFinance();
    const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form and try again.");
    const { id, date, ...rest } = parsed.data;
    if (!(await db.expenseCategory.findUnique({ where: { id: rest.categoryId }, select: { id: true } }))) return fail("That category no longer exists — pick another.");
    if (rest.ownerId && !(await db.stockOwner.findUnique({ where: { id: rest.ownerId }, select: { id: true } }))) return fail("That owner no longer exists — pick another.");
    const data = { ...rest, date: entryDate(date) };
    if (id) {
      const found = await db.expense.updateMany({ where: { id }, data });
      if (found.count === 0) return fail("That expense no longer exists — it may have been deleted. Reload the page.");
    } else {
      await db.expense.create({ data: { ...data, createdByEmail: admin.email } });
    }
    refresh();
    return OK;
  });
}

export async function deleteExpense(id: string): Promise<Result> {
  return deleteExpenses([id]);
}

export async function deleteExpenses(ids: string[]): Promise<Result> {
  return guarded("deleteExpenses", async () => {
    await requireFinance();
    await db.expense.deleteMany({ where: { id: { in: ids } } });
    refresh();
    return OK;
  });
}

// ================================================================================ expense categories
//
// There is no built-in list: a category exists only because an admin created it. An expense can't
// be saved without one, and a category that still has expenses can't be deleted.

const categoryName = z.string().trim().min(1, "Type a name for the category.").max(60, "Keep the name under 60 characters.");

async function categoryNameTaken(name: string, exceptId?: string) {
  const clash = await db.expenseCategory.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { name: true } });
  return clash?.name ?? null;
}

export async function createExpenseCategory(_prev: Result | null, formData: FormData): Promise<Result & { id?: string }> {
  return guarded("createExpenseCategory", async () => {
    await requireFinance();
    const parsed = categoryName.safeParse(formData.get("name") ?? "");
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Type a name for the category.");
    const taken = await categoryNameTaken(parsed.data);
    if (taken) return fail(`There is already a category called "${taken}".`);
    const created = await db.expenseCategory.create({ data: { name: parsed.data } });
    refresh();
    return { ok: true, error: "", id: created.id };
  });
}

export async function renameExpenseCategory(id: string, name: string): Promise<Result> {
  return guarded("renameExpenseCategory", async () => {
    await requireFinance();
    const parsed = categoryName.safeParse(name);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Type a name for the category.");
    const taken = await categoryNameTaken(parsed.data, id);
    if (taken) return fail(`There is already a category called "${taken}".`);
    const found = await db.expenseCategory.updateMany({ where: { id }, data: { name: parsed.data } });
    if (found.count === 0) return fail("That category no longer exists — reload the page.");
    refresh();
    return OK;
  });
}

export async function deleteExpenseCategory(id: string): Promise<Result> {
  return guarded("deleteExpenseCategory", async () => {
    await requireFinance();
    const category = await db.expenseCategory.findUnique({ where: { id }, include: { _count: { select: { expenses: true } } } });
    if (!category) return OK; // already gone
    if (category._count.expenses > 0) {
      return fail(`"${category.name}" is used by ${category._count.expenses} expense${category._count.expenses === 1 ? "" : "s"}, so it can't be deleted. Move or delete those expenses first, or rename the category.`);
    }
    await db.expenseCategory.delete({ where: { id } });
    refresh();
    return OK;
  });
}

// ================================================================================ owners

export async function createStockOwner(_prev: Result | null, formData: FormData): Promise<Result> {
  return guarded("createStockOwner", async () => {
    await requireFinance();
    const name = String(formData.get("name") ?? "").trim();
    if (!name) return fail("Owner name is required.");
    await db.stockOwner.create({ data: { name, contact: String(formData.get("contact") ?? "").trim() || null, notes: String(formData.get("notes") ?? "").trim() || null } });
    refresh();
    return OK;
  });
}

export async function saveStockOwner(_prev: Result | null, formData: FormData): Promise<Result> {
  return guarded("saveStockOwner", async () => {
    await requireFinance();
    const parsed = z
      .object({ id: z.string().min(1), name: text(100).min(1, "Owner name is required."), contact: optional(120), notes: optional(300) })
      .safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form and try again.");
    const { id, ...data } = parsed.data;
    const found = await db.stockOwner.updateMany({ where: { id }, data });
    if (found.count === 0) return fail("That owner no longer exists — reload the page.");
    refresh();
    return OK;
  });
}

export async function deleteStockOwner(id: string): Promise<Result> {
  return guarded("deleteStockOwner", async () => {
    await requireFinance();
    const used = await db.expense.count({ where: { ownerId: id } });
    if (used > 0) return fail(`This owner paid ${used} expense${used === 1 ? "" : "s"}, so they can't be removed. Edit or delete those expenses first.`);
    await db.stockOwner.deleteMany({ where: { id } });
    refresh();
    return OK;
  });
}
