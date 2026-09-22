import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminTopbar } from "@/components/admin/AdminTopbar";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="flex min-h-screen bg-ink text-paper">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <AdminTopbar name={session.name} />
        <div className="p-5.5 desktop:p-6.5">{children}</div>
      </div>
    </div>
  );
}
