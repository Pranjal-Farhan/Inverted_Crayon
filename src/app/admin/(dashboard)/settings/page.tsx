import { getShippingRates, getPaymentGateways, getStoreInfo, getTaxSettings, getEmailTemplates } from "@/lib/store-settings";
import { getAdminSession } from "@/lib/session";
import { db } from "@/lib/db";
import { SettingsView } from "@/components/admin/SettingsView";

export default async function AdminSettingsPage() {
  const session = await getAdminSession();
  const [rates, gateways, storeInfo, tax, emailTemplates, staff] = await Promise.all([
    getShippingRates(),
    getPaymentGateways(),
    getStoreInfo(),
    getTaxSettings(),
    getEmailTemplates(),
    db.adminUser.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <SettingsView
      rates={rates}
      gateways={gateways}
      storeInfo={storeInfo}
      tax={tax}
      emailTemplates={emailTemplates}
      staff={staff}
      selfId={session!.adminId}
    />
  );
}
