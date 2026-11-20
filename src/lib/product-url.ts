/**
 * The public address of a product's page on the storefront — what a customer would open, and what
 * the admin's "Copy link" buttons put on the clipboard. `origin` is the site's own address
 * (`getSiteOrigin()` on the server: SITE_URL, or the address the admin is browsing); a trailing
 * slash on it is ignored. Pure, so the server pages and the browser both use it.
 */
export function publicProductUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/+$/, "")}/product/${encodeURIComponent(slug)}`;
}
