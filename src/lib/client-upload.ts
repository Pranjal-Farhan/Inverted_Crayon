import { prepareImageForUpload } from "@/lib/client-image";
import type { ProductImageRow } from "@/lib/product-images";

/**
 * Browser side of the product-photo upload: one photo per request to /api/admin/products/[id]/images.
 *
 * This is a plain XHR rather than a Server Action on purpose. Actions are run one after another by
 * the browser and each one re-renders the page when it finishes — a second photo could sit behind
 * the first one's refresh for ever. An XHR is independent, reports real upload progress, and has a
 * hard timeout, so the page can always say what is happening and can never be left waiting.
 */

export type UploadStage = {
  /** 0-based position of the photo being handled. */
  index: number;
  total: number;
  phase: "preparing" | "sending" | "processing";
  /** 0-100 while sending. */
  pct?: number;
};

export type UploadFailure = { name: string; error: string };
export type UploadResult = { images: ProductImageRow[]; failed: UploadFailure[] };

/** The server answers within ~60s even when ImgBB is struggling (see the route's maxDuration), so
 * anything past this is a dead connection. */
const REQUEST_TIMEOUT_MS = 100_000;

export function describeStage(stage: UploadStage): string {
  const n = `${Math.min(stage.index + 1, stage.total)} of ${stage.total}`;
  if (stage.phase === "preparing") return `Preparing image ${n}…`;
  if (stage.phase === "sending") return `Sending image ${n}${stage.pct != null ? ` — ${stage.pct}%` : ""}…`;
  return `Saving image ${n}…`;
}

function httpMessage(status: number): string {
  if (status === 401 || status === 403) return "You're signed out or not allowed to edit products — reload the page and sign in again.";
  if (status === 413) return "The host refused this photo as too large.";
  if (status === 504 || status === 502) return "The server gave up waiting for the image host. Try again in a minute.";
  return `Upload failed (HTTP ${status}).`;
}

type PostResult = { image: ProductImageRow } | { error: string };

function postPhoto(productId: string, file: File, onStage: (phase: "sending" | "processing", pct?: number) => void): Promise<PostResult> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/admin/products/${encodeURIComponent(productId)}/images`);
    xhr.timeout = REQUEST_TIMEOUT_MS;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onStage("sending", Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.upload.onload = () => onStage("processing");
    xhr.onload = () => {
      let body: { ok?: boolean; image?: ProductImageRow; error?: string } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && body?.ok && body.image) resolve({ image: body.image });
      else resolve({ error: body?.error ?? httpMessage(xhr.status) });
    };
    xhr.onerror = () => resolve({ error: "Couldn't reach the server — check your connection and try again." });
    xhr.ontimeout = () => resolve({ error: `No answer from the server after ${REQUEST_TIMEOUT_MS / 1000}s — try again.` });
    xhr.onabort = () => resolve({ error: "The upload was cancelled." });
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

/** Uploads photos one at a time, in order, and never throws: every failure comes back in `failed`
 * with the file's name while the other photos carry on. */
export async function uploadProductPhotos(
  productId: string,
  files: File[],
  opts: { onStage?: (stage: UploadStage) => void; onImage?: (image: ProductImageRow) => void } = {},
): Promise<UploadResult> {
  const images: ProductImageRow[] = [];
  const failed: UploadFailure[] = [];
  for (const [index, original] of files.entries()) {
    const stage = (phase: UploadStage["phase"], pct?: number) => opts.onStage?.({ index, total: files.length, phase, pct });
    try {
      stage("preparing");
      const file = await prepareImageForUpload(original);
      stage("sending", 0);
      const res = await postPhoto(productId, file, (phase, pct) => stage(phase, pct));
      if ("image" in res) {
        images.push(res.image);
        opts.onImage?.(res.image);
      } else {
        failed.push({ name: original.name, error: res.error });
      }
    } catch (e) {
      failed.push({ name: original.name, error: e instanceof Error ? e.message : "Upload failed." });
    }
  }
  return { images, failed };
}
