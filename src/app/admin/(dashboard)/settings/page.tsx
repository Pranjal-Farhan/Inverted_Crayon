import {
  getShippingRates,
  getPaymentGateways,
  getStoreInfo,
  getTaxSettings,
  getChatWidgetSettings,
} from "@/lib/store-settings";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { SettingsView } from "@/components/admin/SettingsView";

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  const [rates, gateways, storeInfo, tax, chatWidget, staff] = await Promise.all([
    getShippingRates(),
    getPaymentGateways(),
    getStoreInfo(),
    getTaxSettings(),
    getChatWidgetSettings(),
    db.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, twoFactorEnabled: true },
    }),
  ]);

  const self = staff.find((s) => s.id === session.adminId);

  return (
    <SettingsView
      rates={rates}
      gateways={gateways}
      storeInfo={storeInfo}
      tax={tax}
      chatWidget={chatWidget}
      staff={staff}
      selfId={session.adminId}
      twoFactorEnabled={self?.twoFactorEnabled ?? false}
    />
  );
}
