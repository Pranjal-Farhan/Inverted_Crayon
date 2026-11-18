import type { NextRequest } from "next/server";
import { handleSslcommerzUnpaidReturn } from "@/lib/payments/sslcommerz-returns";

// SSLCommerz sends the shopper back here (a form POST) when a payment fails. Anyone can call this URL
// with any order number, so it only cancels an order the gateway itself records as failed.
export async function POST(req: NextRequest) {
  return handleSslcommerzUnpaidReturn(req, "failed");
}
