import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { canAccessArea, homeFor, type AdminArea, type AdminRole } from "@/lib/admin-areas";

export type CurrentAdmin = { id: string; email: string; name: string; role: AdminRole };

/**
 * The signed-in admin/staff account — read from the database, not trusted from the session cookie.
 * The cookie is a signed snapshot taken at login, so on its own it would keep a demoted account at
 * its old role (and a removed account signed in) until the cookie expired. One primary-key lookup
 * per request (de-duplicated by cache()) is what makes a role change or a removal take effect
 * immediately.
 */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const session = await getAdminSession();
  if (!session) return null;
  const user = await db.adminUser.findUnique({
    where: { id: session.adminId },
    select: { id: true, email: true, name: true, role: true, passwordChangedAt: true },
  });
  if (!user) return null;
  // A session issued before the owner last changed the password is no longer valid — that is what
  // makes "change password" also sign out every other device.
  if (user.passwordChangedAt && (session.iat ?? 0) < Math.floor(user.passwordChangedAt.getTime() / 1000)) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
});

/** The signed-in account if it may use `area`, else null — for actions that report errors as data. */
export async function getAdminForArea(area: AdminArea): Promise<CurrentAdmin | null> {
  const admin = await getCurrentAdmin();
  return admin && canAccessArea(admin.role, area) ? admin : null;
}

/** For server actions: throws unless the signed-in account may use `area`. Call it first, every time. */
export async function requireAdminArea(area: AdminArea): Promise<CurrentAdmin> {
  const admin = await getAdminForArea(area);
  if (!admin) throw new Error("Not authorized.");
  return admin;
}

/**
 * For admin pages. Signed out -> the login page; signed in but not allowed here -> back to the
 * account's own home. Every page calls this itself, before it reads any data, rather than
 * leaning on the shared layout: layouts and pages render independently, so a layout redirect does
 * not stop a page from running its queries.
 */
export async function requireAdminPage(area: AdminArea): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (!canAccessArea(admin.role, area)) redirect(homeFor(admin.role));
  return admin;
}
