/**
 * Browser-side image preparation for uploads that go through a server action.
 *
 * Vercel rejects any function request whose body is over ~4.5MB, whatever `bodySizeLimit` says in
 * next.config.ts — and a normal phone/camera photo is 3–10MB. The rejected call throws in the
 * browser, so every product-photo upload used to go through a single request holding all the
 * files and hang or fail as soon as the photos were big. The fix is on both ends: each image is
 * sent in its own request, and any image that wouldn't fit under the cap is re-encoded here first
 * (longest side capped, JPEG, quality stepped down until it fits) — still far larger than the
 * ~1000px the storefront ever shows, so the visible quality is unchanged.
 */

/** Largest file sent as-is. The cap is on the whole request body (multipart framing + the other
 * action arguments included), so this leaves comfortable headroom under 4.5MB. */
export const MAX_DIRECT_UPLOAD_BYTES = 3.5 * 1024 * 1024;

/** Longest side of a re-encoded image. The PDP gallery zooms to 2.2x of a ~700px frame, so this
 * is well above anything that gets displayed. */
const MAX_EDGE_PX = 3000;
const QUALITIES = [0.92, 0.86, 0.8, 0.72];

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/** Returns the file untouched when it already fits (and for GIFs, which can't be re-encoded
 * without losing the animation); otherwise a smaller JPEG copy. Throws a readable error when the
 * browser can't decode the file or it can't be brought under the cap. */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (file.size <= MAX_DIRECT_UPLOAD_BYTES) return file;
  if (file.type === "image/gif") {
    throw new Error(`"${file.name}" is a GIF over ${MAX_DIRECT_UPLOAD_BYTES / (1024 * 1024)}MB — shrink it or use a JPG/PNG.`);
  }

  let bitmap: ImageBitmap;
  try {
    // "from-image" is the default, but being explicit keeps phone photos upright.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`"${file.name}" couldn't be read by this browser — try a JPG or PNG.`);
  }

  try {
    let scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    for (let round = 0; round < 4; round++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      // JPEG has no alpha: flatten transparent PNGs onto white rather than letting them go black.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const q of QUALITIES) {
        const blob = await toBlob(canvas, q);
        if (blob && blob.size <= MAX_DIRECT_UPLOAD_BYTES) {
          const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
          return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
        }
      }
      scale *= 0.8; // still too heavy at the lowest quality: shrink the pixels and go again
    }
  } finally {
    bitmap.close();
  }
  throw new Error(`"${file.name}" is too large to upload even after shrinking — try a smaller image.`);
}
