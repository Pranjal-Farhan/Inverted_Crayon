import "server-only";
import sharp from "sharp";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Small copies of product photos, for the places that show a photo at thumbnail size (the hover wheel).
 *
 * Why they exist: the photos themselves live on the image host (ImgBB) at whatever size they were
 * uploaded — up to ~3.5MB, never shrunk. next/image can serve a 48px circle from one, but only by
 * downloading the whole original, decoding it and shrinking it first, once for every size it is asked
 * for. For a product with nine photos that is tens of MB through the server before the first circle
 * fills in, which is the "blank for a long time" the wheel used to show. A thumbnail made once, kept in
 * the database (ProductImageThumb) and served with a year-long cache is a few KB: it appears at once
 * and the image host is never touched again.
 *
 * They are made (1) when a photo is uploaded (product-images.ts, from the bytes already in hand),
 * (2) for photos that predate this, the first time one is asked for (the thumb endpoint), and (3) in
 * bulk from the admin's "Prepare photo thumbnails" button (prepareMissingThumbs below).
 */

/** Side of the square thumbnail, px. The wheel's circles are 28–60 CSS px, so this covers a 2x screen. */
export const THUMB_PX = 120;
const THUMB_QUALITY = 68;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_ORIGINAL_BYTES = 30 * 1024 * 1024;

/**
 * Where an original may be downloaded from to make its thumbnail. Uploads all go to ImgBB, so that is
 * the only host this will ever fetch from — never an address typed into a form or a database row
 * elsewhere (a server that fetches arbitrary addresses is an open door to the network behind it).
 * IMAGE_FETCH_HOSTS adds more (comma-separated host[:port]), used by the tests' local mock host.
 */
function allowedFetch(url: URL): boolean {
  // ImgBB's own hosts: i.ibb.co and its newer i.ibb.co.com (and any subdomain of either).
  if (url.protocol === "https:" && /(^|\.)ibb\.co(\.com)?$/i.test(url.hostname) && !url.port) return true;
  const extra = (process.env.IMAGE_FETCH_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  return extra.includes(url.host);
}

/** A square WebP of `input`: centre-cropped (what the wheel's `object-cover` circle would show), upright per its EXIF tag. */
export async function makeThumb(input: Uint8Array): Promise<Buffer> {
  const image = sharp(input, { failOn: "none" });
  const { format } = await image.metadata();
  // Uploads refuse SVG (it can carry script); a stored one is no more welcome here.
  if (!format || format === "svg") throw new Error("Not a photo format.");
  return image
    .rotate()
    .resize(THUMB_PX, THUMB_PX, { fit: "cover", position: "centre" })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();
}

/** Why the last attempt for a photo failed, for the admin's "couldn't be prepared" message. */
export const thumbFailures = new Map<string, string>();

/** The bytes of a photo's original; throws with a plain reason when it can't be had (a host we won't fetch from, a dead link, too big). */
async function readOriginal(url: string): Promise<Buffer> {
  const u = url.trim();
  // The oldest uploads were stored inline as data: URLs — the bytes are already here.
  const inline = u.match(/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,(.+)$/i);
  if (inline) return Buffer.from(inline[1], "base64");
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    throw new Error("the photo's address isn't a web address");
  }
  if (!allowedFetch(parsed)) throw new Error(`photo is on ${parsed.host}, not the image host`);
  // Redirects are followed by hand, a few hops at most, and only ever to another image-host address:
  // a redirect to anywhere else is never requested.
  let res: Response | null = null;
  for (let hop = 0; hop < 4 && parsed; hop++) {
    res = await fetch(parsed, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "manual",
      cache: "no-store",
      headers: { Accept: "image/*", "User-Agent": "Mozilla/5.0 (compatible; InvertedCrayonThumbs/1.0)" },
    }).catch((e: unknown) => {
      throw new Error(`image host didn't answer (${e instanceof Error ? e.name : "error"})`);
    });
    const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!next) break;
    parsed = new URL(next, parsed);
    if (!allowedFetch(parsed)) throw new Error("redirected away from the image host");
  }
  if (!res) throw new Error("no answer from the image host");
  if (!res.ok) throw new Error(`image host answered ${res.status}`);
  const declared = Number(res.headers.get("content-length"));
  if (declared > MAX_ORIGINAL_BYTES) throw new Error("photo is too large");
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_ORIGINAL_BYTES) throw new Error("photo is too large");
  return bytes;
}

// Several visitors (or one product's nine circles) asking for the same missing thumbnail at once
// share one download-and-shrink, and a burst of different ones is metered — at most MAX_PARALLEL
// originals in flight per function instance, the rest waiting their turn (a little while, then they
// give up and the endpoint falls back to next/image) — so a cold page can't turn into a pile of
// multi-MB downloads all held in memory at once.
const inFlight = new Map<string, Promise<Buffer | null>>();
const MAX_PARALLEL = 12;
const QUEUE_WAIT_MS = 8_000;
let running = 0;
const waiting: Array<() => void> = [];

function acquire(): Promise<boolean> {
  if (running < MAX_PARALLEL) {
    running++;
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const turn = () => {
      clearTimeout(timer);
      running++;
      resolve(true);
    };
    const timer = setTimeout(() => {
      const at = waiting.indexOf(turn);
      if (at >= 0) waiting.splice(at, 1);
      resolve(false);
    }, QUEUE_WAIT_MS);
    waiting.push(turn);
  });
}

function release() {
  running--;
  waiting.shift()?.();
}

/**
 * Makes and stores the thumbnail for one photo from its original; resolves to its bytes, or null if
 * that wasn't possible. `capped` (the default, for requests from visitors) waits for a free slot (see
 * above); the admin's bulk run isn't metered because it never asks for more than a handful at once.
 */
export function createThumb(imageId: string, url: string, options: { capped?: boolean } = {}): Promise<Buffer | null> {
  const capped = options.capped ?? true;
  const existing = inFlight.get(imageId);
  if (existing) return existing;
  const job = (async () => {
    let held = false;
    try {
      if (capped) {
        held = await acquire();
        if (!held) {
          thumbFailures.set(imageId, "too many being made at once");
          return null;
        }
      }
      const original = await readOriginal(url);
      const data = await makeThumb(original);
      thumbFailures.delete(imageId);
      // A second instance may have made it a moment earlier: that is fine, keep theirs.
      await db.productImageThumb.createMany({ data: [{ imageId, data: new Uint8Array(data) }], skipDuplicates: true });
      return data;
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      thumbFailures.set(imageId, why);
      console.warn(`[image-thumb] couldn't make a thumbnail for photo ${imageId}: ${why}`);
      return null;
    } finally {
      if (held) release();
      inFlight.delete(imageId);
    }
  })();
  inFlight.set(imageId, job);
  return job;
}

/**
 * The photos worth preparing a thumbnail for: those of live products that have none yet and that one
 * can actually be made from — an original on the image host, or one stored inline (the oldest
 * uploads). Anything else (a stray relative path, say) isn't something this server would fetch, so it
 * isn't counted or attempted. The admin page counts these and prepareMissingThumbs works through
 * them, so what the button promises and what it does always agree.
 */
export function thumbCandidates(): Prisma.ProductImageWhereInput {
  return {
    product: { status: "ACTIVE" },
    OR: [{ url: { startsWith: "https://" } }, { url: { startsWith: "http://" } }, { url: { startsWith: "data:image/" } }],
  };
}

export function photosNeedingThumbs(): Prisma.ProductImageWhereInput {
  return { ...thumbCandidates(), thumb: { is: null } };
}

/** The numbers behind the admin's thumbnail bar. */
export async function thumbStats() {
  const [total, missing, unsupported] = await Promise.all([
    db.productImage.count({ where: thumbCandidates() }),
    db.productImage.count({ where: photosNeedingThumbs() }),
    // Live photos whose address isn't a web address at all (an old local-file path): no thumbnail can be made from them.
    db.productImage.count({ where: { product: { status: "ACTIVE" }, NOT: { OR: [{ url: "" }, ...(thumbCandidates().OR as Prisma.ProductImageWhereInput[])] } } }),
  ]);
  return { total, missing, unsupported, checkedAt: Date.now() };
}

/**
 * Makes thumbnails for photos that have none yet — newest products first — a few at a time, stopping
 * when `budgetMs` is used up. Powers the admin's "Prepare photo thumbnails" button, which calls it
 * until `remaining` reaches 0 (or nothing more can be made: `failed` counts the photos whose original
 * couldn't be fetched, which are skipped for the rest of that run).
 */
export async function prepareMissingThumbs(options: { budgetMs: number; skip?: string[] }): Promise<{ made: number; failed: string[]; remaining: number; reasons: string[] }> {
  const started = Date.now();
  let made = 0;
  const failed: string[] = [];
  // Photos that still need one and haven't already failed in this run.
  const missing = (): Prisma.ProductImageWhereInput => ({ ...photosNeedingThumbs(), id: { notIn: [...(options.skip ?? []), ...failed] } });
  while (Date.now() - started < options.budgetMs) {
    const batch = await db.productImage.findMany({
      where: missing(),
      select: { id: true, url: true },
      orderBy: [{ product: { createdAt: "desc" } }, { position: "asc" }],
      take: MAX_PARALLEL,
    });
    if (batch.length === 0) break;
    const results = await Promise.all(batch.map(async (img) => ({ id: img.id, data: await createThumb(img.id, img.url, { capped: false }) })));
    for (const r of results) {
      if (r.data) made++;
      else failed.push(r.id);
    }
  }
  const remaining = await db.productImage.count({ where: missing() });
  const reasons = [...new Set(failed.map((id) => thumbFailures.get(id)).filter((r): r is string => !!r))].slice(0, 4);
  return { made, failed, remaining, reasons };
}
