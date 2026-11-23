"use server";

import { getAdminForArea } from "@/lib/admin-guard";
import { prepareMissingThumbs } from "@/lib/image-thumb";
import { describeError } from "@/lib/action-errors";

/**
 * The Products page's "Prepare photo thumbnails" button: makes the small copies (see
 * src/lib/image-thumb.ts) for photos uploaded before they existed, so the storefront's hover wheel
 * shows them at once instead of making each one on first request. Whoever may use Products may use it;
 * it only ever adds thumbnails — nothing is changed or deleted.
 *
 * One call works for up to ~40s and says how many photos are left; the button calls it again until
 * none are, or until the only ones left are photos whose original can't be fetched (`failed`, which
 * the next call is told to skip).
 */

export type PrepareThumbsResult = { ok: true; made: number; failed: string[]; remaining: number; reasons: string[] } | { ok: false; error: string };

export async function prepareThumbnails(skip: string[] = []): Promise<PrepareThumbsResult> {
  if (!(await getAdminForArea("products"))) return { ok: false, error: "Your session has ended — log in again, then try once more." };
  try {
    const result = await prepareMissingThumbs({ budgetMs: 40_000, skip: skip.filter((id) => typeof id === "string").slice(0, 500) });
    return { ok: true, ...result };
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }
}
