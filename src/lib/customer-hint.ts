/**
 * Name of the small, non-httpOnly cookie that mirrors whether a customer session exists, without
 * carrying any identifying data (no id/email/name — just presence). Set/cleared in lockstep with
 * the real httpOnly session cookie in src/lib/session.ts, and read client-side (src/lib/use-logged-in.ts)
 * so public pages can render the same HTML for every visitor and reveal the logged-in state only
 * after mount — avoiding a cookies()/getCustomerSession() call in shared public UI, which would
 * otherwise force every page under it to render dynamically.
 */
export const CUSTOMER_HINT_COOKIE = "ic_customer_hint";
