/**
 * Turns an admin-typed manufacturer link into something safe to put in an `href`, or null if it
 * isn't a web address. Admins paste bare "supplier.com/page" as often as full URLs — left as-is
 * that resolves against the admin page's own URL, so a missing scheme gets https:// prepended.
 * Anything else (mailto:, javascript:, free-text notes) isn't linkable and stays plain text.
 */
export function manufacturerHref(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|\?|#|:|$)/i.test(value)) return `https://${value}`;
  return null;
}

/** Compact display form of a link for dense lists: no scheme, no leading "www.", no trailing slash. */
export function manufacturerLabel(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}
