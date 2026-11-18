import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";

// Lives here, not in src/actions/admin-categories.ts: every export of a "use server" file is a server
// action anyone can call over HTTP, and this one has no permission check of its own — as an action
// it let anyone create categories that show up in the storefront's navigation. Its callers (category
// and product saves) check permissions first.

/**
 * A Unisex subcategory is browsable from every branch — if it doesn't already have a
 * same-name/slug sibling under Men and Women, create one. Products never move: a Unisex
 * product keeps its single categoryId, and shows up under the mirrored Men/Women branch at
 * query time by matching gender + slug (see getPLPResults in src/lib/plp.ts). This just keeps
 * the taxonomy itself (header dropdowns, the admin's subcategory picker) consistent across
 * branches so "Jeans" is selectable/visible everywhere a Unisex Jeans product would surface.
 */
export async function ensureMirrorCategories(name: string, slug: string) {
  for (const gender of ["MEN", "WOMEN"] as const) {
    const existing = await db.category.findFirst({ where: { gender, slug } });
    if (existing) continue;
    const maxPosition = await db.category.aggregate({ where: { gender }, _max: { position: true } });
    try {
      await db.category.create({
        data: { name, slug, gender, position: (maxPosition._max.position ?? -1) + 1 },
      });
    } catch (e) {
      // Two saves racing to mirror the same category at once can both pass the check above —
      // whichever loses the create to the unique (gender, slug) constraint just means the other
      // one already finished the job, which is exactly what this function is trying to ensure.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
}
