import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-guard";

export default async function ReceiptLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return <>{children}</>;
}
