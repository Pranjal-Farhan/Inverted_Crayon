import { db } from "@/lib/db";
import { createThumb } from "@/lib/image-thumb";

// The small copy of one product photo (see src/lib/image-thumb.ts) — what the storefront's hover wheel
// shows in its circles. A thumbnail never changes (a replaced photo is a new row with a new id), so it
// is cached for a year, by the browser and by the CDN.
export const dynamic = "force-dynamic";
// A photo from before thumbnails existed is made here the first time it is asked for: download the
// original (bounded by image-thumb.ts's own timeout), shrink it, keep it.
export const maxDuration = 30;

type Params = { params: Promise<{ id: string }> };

const FOREVER = "public, max-age=31536000, s-maxage=31536000, immutable";
const NEVER = "no-store";

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  // Photo ids are cuids; anything else can't be one, so don't even ask the database.
  if (!/^[a-z0-9_-]{8,40}$/i.test(id)) return new Response(null, { status: 404, headers: { "Cache-Control": NEVER } });

  const row = await db.productImage.findUnique({
    where: { id },
    select: { url: true, thumb: { select: { data: true } }, product: { select: { status: true } } },
  });
  // Only live products' photos: a draft's photos aren't shown anywhere on the shop yet.
  if (!row || row.product.status !== "ACTIVE") return new Response(null, { status: 404, headers: { "Cache-Control": NEVER } });

  const data = row.thumb?.data ?? (await createThumb(id, row.url));
  if (data) {
    return new Response(new Uint8Array(data), { headers: { "Content-Type": "image/webp", "Cache-Control": FOREVER } });
  }

  // Couldn't make one (the image host didn't answer, the link is dead, too many are being made right
  // now): send the browser to next/image for this photo instead — slower, but it still ends up
  // with a picture — and don't let anyone cache that decision.
  if (!/^https?:\/\//i.test(row.url)) return new Response(null, { status: 404, headers: { "Cache-Control": NEVER } });
  return new Response(null, {
    status: 307,
    headers: { Location: `/_next/image?url=${encodeURIComponent(row.url)}&w=128&q=75`, "Cache-Control": NEVER },
  });
}
