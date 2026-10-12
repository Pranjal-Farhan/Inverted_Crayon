"server-only";

const IMGBB_UPLOAD_URL = "https://api.imgbb.com/1/upload";

// A large, legitimately high-resolution photo can genuinely take a while on a slow connection —
// this just needs to be long enough that a real (if slow) upload isn't mistaken for a hang, not
// so long that a truly dead connection ties up the request for minutes.
const UPLOAD_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = [1000, 2500];

type ImgBbResponse = {
  success: boolean;
  data?: {
    display_url?: string;
    url?: string;
  };
  error?: { message?: string };
};

type AttemptResult = { ok: true; url: string } | { ok: false; retryable: boolean; error: Error };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptUpload(file: File, apiKey: string): Promise<AttemptResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const formData = new FormData();
    formData.append("image", file);
    const response = await fetch(`${IMGBB_UPLOAD_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    const result = (await response.json().catch(() => null)) as ImgBbResponse | null;
    const imageUrl = result?.data?.display_url ?? result?.data?.url;

    if (response.ok && result?.success && imageUrl) return { ok: true, url: imageUrl };

    // A 4xx (bad image, bad key, ImgBB-side rejection) will fail identically on retry — only a
    // 5xx (ImgBB having a bad moment) is worth trying again.
    return {
      ok: false,
      retryable: response.status >= 500,
      error: new Error(result?.error?.message ?? `ImgBB upload failed (HTTP ${response.status}).`),
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      retryable: true, // a network drop or our own timeout — both worth one more try
      error: timedOut
        ? new Error(`"${file.name}" timed out uploading — it may be too large for the current connection.`)
        : error instanceof Error
          ? error
          : new Error("Image upload failed."),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function uploadToImgBb(file: File): Promise<string> {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) throw new Error("IMGBB_API_KEY is not configured.");

  let lastError = new Error("Image upload failed.");
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const result = await attemptUpload(file, apiKey);
    if (result.ok) return result.url;
    lastError = result.error;
    if (!result.retryable || attempt === MAX_ATTEMPTS) break;
    await sleep(RETRY_DELAY_MS[attempt - 1] ?? 2500);
  }
  throw lastError;
}
