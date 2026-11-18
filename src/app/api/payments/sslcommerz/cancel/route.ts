import type { NextRequest } from "next/server";
import { handleSslcommerzUnpaidReturn } from "@/lib/payments/sslcommerz-returns";

// SSLCommerz sends the shopper back here (a form POST) when they cancel on its payment page. Anyone can
// call this URL with any order number, so it only cancels an order the gateway itself records as
// cancelled or failed.
export async function POST(req: NextRequest) {
  return handleSslcommerzUnpaidReturn(req, "cancelled");
}
