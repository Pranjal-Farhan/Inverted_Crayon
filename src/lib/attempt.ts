/**
 * Calls a server action from the browser and never throws. The server side of every admin action
 * already answers { ok, error } in words (see action-errors.ts); what can still go wrong is the
 * trip itself — the connection dropped, the site was redeployed since the page loaded, the request
 * timed out. Without this, that would surface as the page's generic error screen; with it the
 * person sees the reason next to what they clicked, and nothing is lost on the screen.
 */
export const NETWORK_ERROR = "Couldn't reach the server, so nothing was saved. Check your connection (or reload the page if the site was just updated) and try again.";

export async function attempt<T extends { ok: boolean; error: string }>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    // The extra fields some actions return (qty, orderId…) are absent on a failure, and callers only read them when ok.
    return { ok: false, error: NETWORK_ERROR } as T;
  }
}
