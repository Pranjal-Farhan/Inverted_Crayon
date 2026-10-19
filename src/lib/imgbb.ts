import "server-only";

const IMGBB_UPLOAD_URL = process.env.IMGBB_UPLOAD_URL || "https://api.imgbb.com/1/upload";

// One attempt has to be short: a request that ImgBB accepts but never answers is the failure we
// care about, and waiting 45s on it three times (the old setting) ran past the platform's own
// function limit, so the admin got nothing back at all. A normal photo upload takes a few seconds,
// so 3 attempts of 15s plus the pauses stay inside the route's 60s budget (see the upload route).
const UPLOAD_TIMEOUT_MS = Number(process.env.IMGBB_ATTEMPT_TIMEOUT_MS) || 15_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = [1000, 2000];

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
      // A brand-new connection every time. Node keeps connections to the same host open and reuses
      // them, and on a serverless host a reused one is often already dead (closed on ImgBB's side
      // while this instance sat idle) — the request is then written into the void and never
      // answered. `Connection: close` makes each attempt, including every retry, start clean.
      headers: { Connection: "close" },
      cache: "no-store",
    });
    const result = (await response.json().catch(() => null)) as ImgBbResponse | null;
    const imageUrl = result?.data?.display_url ?? result?.data?.url;

    if (response.ok && result?.success && imageUrl) return { ok: true, url: imageUrl };

    // A 4xx (bad image, bad key, ImgBB-side rejection) will fail identically on retry — only a
    // 5xx (ImgBB having a bad moment) or a 429 (slow down) is worth trying again.
    return {
      ok: false,
      retryable: response.status >= 500 || response.status === 429,
      error: new Error(result?.error?.message ?? `ImgBB upload failed (HTTP ${response.status}).`),
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      retryable: true, // a network drop or our own timeout — both worth another try
      error: timedOut
        ? new Error(`ImgBB didn't answer within ${Math.round(UPLOAD_TIMEOUT_MS / 1000)}s`)
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
  if (!apiKey) throw new Error("IMGBB_API_KEY is not configured on the server.");

  let lastError = new Error("Image upload failed.");
  let attempts = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attempts = attempt;
    const result = await attemptUpload(file, apiKey);
    if (result.ok) return result.url;
    lastError = result.error;
    console.warn(`[imgbb] attempt ${attempt}/${MAX_ATTEMPTS} failed for "${file.name}" (${file.size} bytes): ${result.error.message}`);
    if (!result.retryable || attempt === MAX_ATTEMPTS) break;
    await sleep(RETRY_DELAY_MS[attempt - 1] ?? 2000);
  }
  throw new Error(
    attempts > 1 ? `${lastError.message} (tried ${attempts} times — the image host is struggling, try again in a minute)` : lastError.message,
  );
}
