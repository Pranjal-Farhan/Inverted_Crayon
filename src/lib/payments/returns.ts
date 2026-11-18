import "server-only";
import { NextResponse, type NextRequest } from "next/server";

/** Longest order number / gateway id we'll look up or pass on to a gateway — real ones are far shorter. */
export const MAX_GATEWAY_ID_LENGTH = 100;

/** Where to send the shopper's browser next. 303 turns a gateway's form POST into a plain GET of the page. */
export function redirectShopper(req: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, req.url), 303);
}
