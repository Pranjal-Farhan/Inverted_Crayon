/**
 * Who may use which part of the admin. Client-safe (the sidebar and the Settings tabs read it too);
 * the server-side enforcement that actually protects the data lives in src/lib/admin-guard.ts.
 *
 * ADMIN can use everything. STAFF — the people who run day-to-day orders and the catalogue — can
 * use only the areas in STAFF_AREAS. Everything else (the money, the site's content, the message
 * templates, the store settings and the account list) is admin-only.
 */
export type AdminRole = "ADMIN" | "STAFF";

export type AdminArea =
  // open to staff
  | "orders"
  | "products"
  | "inventory"
  | "customers"
  | "discounts"
  | "size-guides"
  | "categories"
  | "security" // a person's own two-factor setup — Settings -> Security
  // admin only
  | "dashboard"
  | "finance"
  | "analytics"
  | "content"
  | "footer"
  | "emails"
  | "templates"
  | "store" // Settings -> Store info and Chat
  | "staff"; // Settings -> Roles: inviting, re-roling and removing accounts

const STAFF_AREAS: ReadonlySet<AdminArea> = new Set<AdminArea>([
  "orders",
  "products",
  "inventory",
  "customers",
  "discounts",
  "size-guides",
  "categories",
  "security",
]);

export function canAccessArea(role: AdminRole, area: AdminArea): boolean {
  return role === "ADMIN" || STAFF_AREAS.has(area);
}

/** Where a signed-in account lands: admins get the dashboard, staff (who can't see it) get Orders. */
export function homeFor(role: AdminRole): string {
  return role === "ADMIN" ? "/admin/dashboard" : "/admin/orders";
}
