import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-guard";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <div className="flex min-h-screen bg-ink text-paper">
      <AdminSidebar role={admin.role} />
      <div className="min-w-0 flex-1">
        <AdminTopbar name={admin.name} />
        <div className="p-5.5 desktop:p-6.5">{children}</div>
      </div>
    </div>
  );
}
