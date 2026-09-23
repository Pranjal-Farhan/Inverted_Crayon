import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";

export default async function ReceiptLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return <>{children}</>;
}
