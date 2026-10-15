import { redirect } from "next/navigation";
import { homeFor } from "@/lib/admin-areas";
import { getCurrentAdmin } from "@/lib/admin-guard";

export default async function AdminIndexPage() {
  const admin = await getCurrentAdmin();
  redirect(admin ? homeFor(admin.role) : "/admin/login");
}
