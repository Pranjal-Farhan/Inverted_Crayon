import "server-only";

/**
 * bKash Tokenized Checkout (v1.2.0-beta) integration. Needs a real bKash merchant account to do
 * anything — when the env vars below aren't set, `bkashConfigured()` returns false and callers
 * fall back to the app's existing mocked instant-paid flow, exactly as before this integration
 * existed. Set these to go live (sandbox first): BKASH_APP_KEY, BKASH_APP_SECRET,
 * BKASH_USERNAME, BKASH_PASSWORD, and optionally BKASH_BASE_URL (defaults to bKash's sandbox).
 */

const BASE_URL = process.env.BKASH_BASE_URL || "https://tokenized.sandbox.bka.sh/v1.2.0-beta";

export function bkashConfigured(): boolean {
  return Boolean(
    process.env.BKASH_APP_KEY && process.env.BKASH_APP_SECRET && process.env.BKASH_USERNAME && process.env.BKASH_PASSWORD,
  );
}

let cachedToken: { idToken: string; expiresAt: number } | null = null;

async function grantToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.idToken;

  const res = await fetch(`${BASE_URL}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: process.env.BKASH_USERNAME!,
      password: process.env.BKASH_PASSWORD!,
    },
    body: JSON.stringify({
      app_key: process.env.BKASH_APP_KEY,
      app_secret: process.env.BKASH_APP_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`bKash token grant failed: ${res.status}`);
  const data = await res.json();
  if (!data.id_token) throw new Error(`bKash token grant failed: ${JSON.stringify(data)}`);

  // bKash tokens are valid ~1hr; refresh a little early.
  cachedToken = { idToken: data.id_token, expiresAt: Date.now() + 55 * 60_000 };
  return data.id_token;
}

async function authedHeaders() {
  const idToken = await grantToken();
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: idToken,
    "X-App-Key": process.env.BKASH_APP_KEY!,
  };
}

export async function createBkashPayment(params: {
  amount: number;
  orderNumber: string;
  callbackURL: string;
}): Promise<{ bkashURL: string; paymentID: string }> {
  const res = await fetch(`${BASE_URL}/tokenized/checkout/create`, {
    method: "POST",
    headers: await authedHeaders(),
    body: JSON.stringify({
      mode: "0011",
      payerReference: params.orderNumber,
      callbackURL: params.callbackURL,
      amount: params.amount.toFixed(2),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: params.orderNumber,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.bkashURL) throw new Error(`bKash create payment failed: ${JSON.stringify(data)}`);
  return { bkashURL: data.bkashURL, paymentID: data.paymentID };
}

export async function executeBkashPayment(
  paymentID: string,
): Promise<{ ok: true; trxID: string; amount: number; merchantInvoiceNumber: string | null } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${BASE_URL}/tokenized/checkout/execute/${encodeURIComponent(paymentID)}`, {
      method: "POST",
      headers: await authedHeaders(),
    });
    const data = await res.json();
    if (data.transactionStatus === "Completed") {
      return { ok: true, trxID: data.trxID, amount: Number(data.amount), merchantInvoiceNumber: data.merchantInvoiceNumber ?? null };
    }
    return { ok: false, reason: data.statusMessage || "Payment was not completed." };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "bKash execute request failed." };
  }
}

/**
 * Where bKash itself says a payment stands ("Initiated", "Completed", …), asked server-to-server —
 * the callback's own ?status= is just part of a URL anyone can type. null when bKash couldn't be asked.
 */
export async function queryBkashPayment(
  paymentID: string,
): Promise<{ transactionStatus: string; amount: number; merchantInvoiceNumber: string | null } | null> {
  try {
    const res = await fetch(`${BASE_URL}/tokenized/checkout/payment/status`, {
      method: "POST",
      headers: await authedHeaders(),
      body: JSON.stringify({ paymentID }),
    });
    const data = await res.json();
    if (typeof data.transactionStatus !== "string") return null;
    return {
      transactionStatus: data.transactionStatus,
      amount: Number(data.amount),
      merchantInvoiceNumber: data.merchantInvoiceNumber ?? null,
    };
  } catch {
    return null;
  }
}
