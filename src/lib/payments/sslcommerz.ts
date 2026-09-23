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

export async function validateSslcommerzTransaction(
  valId: string,
): Promise<{ ok: true; amount: number; tranId: string } | { ok: false; reason: string }> {
  const params = new URLSearchParams({
    val_id: valId,
    store_id: process.env.SSLCOMMERZ_STORE_ID!,
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD!,
    format: "json",
  });
  const res = await fetch(`${BASE_URL}/validator/api/validationserverAPI.php?${params}`);
  const data = await res.json();
  if (data.status === "VALID" || data.status === "VALIDATED") {
    return { ok: true, amount: Number(data.amount), tranId: data.tran_id };
  }
  return { ok: false, reason: data.status || "Validation failed." };
}
