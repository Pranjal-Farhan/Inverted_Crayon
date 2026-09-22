import { getShippingRates, getPaymentGateways, getStoreInfo } from "@/lib/store-settings";
import { SettingsView } from "@/components/admin/SettingsView";

export default async function AdminSettingsPage() {
  const [rates, gateways, storeInfo] = await Promise.all([getShippingRates(), getPaymentGateways(), getStoreInfo()]);
  return <SettingsView rates={rates} gateways={gateways} storeInfo={storeInfo} />;
}
