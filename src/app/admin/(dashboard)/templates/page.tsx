import { getTemplateConfigs } from "@/lib/messages";
import { getStoreInfo } from "@/lib/store-settings";
import { TemplateManager } from "@/components/admin/TemplateManager";

export default async function AdminTemplatesPage() {
  const [configs, store] = await Promise.all([getTemplateConfigs(), getStoreInfo()]);
  return <TemplateManager configs={configs} storeEmail={store.email} />;
}
