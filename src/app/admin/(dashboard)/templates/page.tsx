import { requireAdminPage } from "@/lib/admin-guard";
import { getTemplateConfigs } from "@/lib/messages";
import { getStoreInfo } from "@/lib/store-settings";
import { TemplateManager } from "@/components/admin/TemplateManager";

export default async function AdminTemplatesPage() {
  await requireAdminPage("templates");
  const [configs, store] = await Promise.all([getTemplateConfigs(), getStoreInfo()]);
  return <TemplateManager configs={configs} storeEmail={store.email} />;
}
