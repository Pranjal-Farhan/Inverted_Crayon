import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { invalidateProduct } from "@/lib/invalidate";
import { uploadToImgBb } from "@/lib/imgbb";

// ImgBB's own free-tier cap is ~32MB/image — 20MB leaves headroom under that while still
// comfortably covering a high-resolution (up to 2000x2500px) product photo, PNG included (a
// photographic PNG at that resolution can land well past the old 8MB cap that was rejecting them).
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 20;
// SVG is deliberately excluded even though it's an "image/*" type because it can embed scripts.
const REJECTED_IMAGE_TYPES = new Set(["image/svg+xml"]);

export type ProductImageRow = { id: string; url: string; alt: string | null; position: number; accentColor: string | null };

export type AddImageResult =
  | { ok: true; image: ProductImageRow; ms: number }
  | { ok: false; status: number; error: string; ms: number };

/** Validates one photo, sends it to ImgBB and records it as the product's next image. Reports
 * problems as data (never throws for an expected failure) so the caller can show the admin exactly
 * what went wrong — including how long it took, which is what tells "slow host" from "slow ImgBB". */
export async function addProductImage(productId: string, file: File): Promise<AddImageResult> {
  const started = Date.now();
  const fail = (status: number, error: string): AddImageResult => ({ ok: false, status, error, ms: Date.now() - started });

  if (!file.type.startsWith("image/") || REJECTED_IMAGE_TYPES.has(file.type)) {
    return fail(415, "Only JPG, PNG, WEBP, GIF or AVIF images are accepted.");
  }
  if (file.size > MAX_IMAGE_BYTES) return fail(413, `Over the ${MAX_IMAGE_BYTES / (1024 * 1024)}MB per-image limit.`);

  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, title: true, slug: true } });
  if (!product) return fail(404, "Product not found — save the product first.");

  const existingCount = await db.productImage.count({ where: { productId } });
  if (existingCount >= MAX_IMAGES_PER_PRODUCT) {
    return fail(409, `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images (${existingCount} already uploaded).`);
  }

  let url: string;
  try {
    url = await uploadToImgBb(file);
  } catch (e) {
    console.error(`[product-images] ImgBB upload failed for product ${productId} (${file.name}, ${file.size} bytes):`, e);
    return fail(502, e instanceof Error ? e.message : "The image host rejected the upload.");
  }

  let image: ProductImageRow;
  try {
    // Position = how many images exist right now, so each photo lands last whatever order the
    // requests finish in; two photos racing for the same slot is harmless (order is editable).
    image = await db.productImage.create({ data: { productId, url, alt: product.title, position: existingCount } });
  } catch (e) {
    console.error(`[product-images] saving the image row failed for product ${productId}:`, e);
    return fail(500, "The photo uploaded but couldn't be saved to the product. Please try again.");
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");
  invalidateProduct({ id: productId, slug: product.slug });
  return { ok: true, image, ms: Date.now() - started };
}
