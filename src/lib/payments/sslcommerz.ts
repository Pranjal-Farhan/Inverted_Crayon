import "server-only";

/**
 * SSLCommerz Hosted Checkout — used for the "Card / mobile banking" payment method. Needs a real
 * SSLCommerz merchant account; when unset, `sslcommerzConfigured()` returns false and callers fall
 * back to the mocked instant-paid flow. Set SSLCOMMERZ_STORE_ID and SSLCOMMERZ_STORE_PASSWORD to
 * go live (sandbox credentials work against the sandbox host by default — set
 * SSLCOMMERZ_SANDBOX=false for production).
 */

const IS_SANDBOX = process.env.SSLCOMMERZ_SANDBOX !== "false";
const BASE_URL = IS_SANDBOX ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com";

export function sslcommerzConfigured(): boolean {
  return Boolean(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD);
}

export async function initSslcommerzSession(params: {
  amount: number;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
}): Promise<{ gatewayPageURL: string }> {
  const body = new URLSearchParams({
    store_id: process.env.SSLCOMMERZ_STORE_ID!,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD!,
    total_amount: params.amount.toFixed(2),
    currency: "BDT",
    tran_id: params.orderNumber,
    success_url: params.successUrl,
    fail_url: params.failUrl,
    cancel_url: params.cancelUrl,
    cus_name: params.customerName,
    cus_email: params.customerEmail,
    cus_phone: params.customerPhone,
    cus_add1: params.customerAddress,
    cus_city: "Dhaka",
    cus_country: "Bangladesh",
    shipping_method: "NO",
    product_name: `Order ${params.orderNumber}`,
    product_category: "Apparel",
    product_profile: "general",
  });

  const res = await fetch(`${BASE_URL}/gwprocess/v4/api.php`, { method: "POST", body });
  const data = await res.json();
  if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
    throw new Error(`SSLCommerz session init failed: ${data.failedreason || JSON.stringify(data)}`);
  }
  return { gatewayPageURL: data.GatewayPageURL };
}

/**
 * Asks SSLCommerz (server-to-server) whether `valId` is a real, completed payment, and for what.
 * The caller must still check that it is for *this* order and amount: a valid val_id only proves
 * that some payment happened — on its own it would let a payment for one order settle another.
 */
export async function validateSslcommerzTransaction(
  valId: string,
): Promise<{ ok: true; amount: number; currency: string; tranId: string } | { ok: false; reason: string }> {
  const params = new URLSearchParams({
    val_id: valId,
    store_id: process.env.SSLCOMMERZ_STORE_ID!,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD!,
    format: "json",
  });
  try {
    const res = await fetch(`${BASE_URL}/validator/api/validationserverAPI.php?${params}`, { cache: "no-store" });
    const data = await res.json();
    if (data.status === "VALID" || data.status === "VALIDATED") {
      // currency_type/currency_amount are what we sent at initiation (BDT); amount is the fallback.
      return {
        ok: true,
        amount: Number(data.currency_amount ?? data.amount),
        currency: String(data.currency_type ?? data.currency ?? ""),
        tranId: String(data.tran_id ?? ""),
      };
    }
    return { ok: false, reason: data.status || "Validation failed." };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Validation request failed." };
  }
}

/**
 * The statuses SSLCommerz holds for one of our order numbers (tran_id), asked server-to-server — so
 * a request to our fail/cancel URLs, which anyone can send, can be checked against what the gateway
 * itself recorded. null when the gateway couldn't be asked.
 */
export async function querySslcommerzTransactionStatuses(tranId: string): Promise<string[] | null> {
  const params = new URLSearchParams({
    tran_id: tranId,
    store_id: process.env.SSLCOMMERZ_STORE_ID!,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD!,
    format: "json",
  });
  try {
    const res = await fetch(`${BASE_URL}/validator/api/merchantTransIDvalidationAPI.php?${params}`, { cache: "no-store" });
    const data = await res.json();
    if (data.APIConnect !== "DONE") return null;
    const elements: { status?: unknown }[] = Array.isArray(data.element) ? data.element : [];
    return elements.map((e) => String(e.status ?? "").toUpperCase());
  } catch {
    return null;
  }
}

/** True only when SSLCommerz records this order's payment as failed/cancelled and never as paid. */
export function sslcommerzSaysUnpaid(statuses: string[]): boolean {
  const paid = statuses.some((s) => s === "VALID" || s === "VALIDATED");
  const failed = statuses.some((s) => s === "FAILED" || s === "CANCELLED" || s === "EXPIRED" || s === "UNATTEMPTED");
  return failed && !paid;
}
