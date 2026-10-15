import { getStoreInfo, getChatWidgetSettings } from "@/lib/store-settings";
import { db } from "@/lib/db";
import { canAccessArea } from "@/lib/admin-areas";
import { requireAdminPage } from "@/lib/admin-guard";
import { SettingsView } from "@/components/admin/SettingsView";
import { TwoFactorSetup } from "@/components/admin/TwoFactorSetup";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";

export default async function AdminSettingsPage() {
  const admin = await requireAdminPage("security");

  // Staff get nothing here but their own two-factor setup — the store details, chat bubble and the
  // account list are admin-only, so none of that data is even loaded for them.
  if (!canAccessArea(admin.role, "store")) {
    const self = await db.adminUser.findUnique({ where: { id: admin.id }, select: { twoFactorEnabled: true } });
    return (
      <div>
        <p className="mb-3.5 max-w-[70ch] text-[13px] text-muted">
          Sign-in security for your own account. Store settings and team accounts are managed by an admin.
        </p>
        <TwoFactorSetup enabled={self?.twoFactorEnabled ?? false} />
        <ChangePasswordForm />
      </div>
    );
  }

  const [storeInfo, chatWidget, staff] = await Promise.all([
    getStoreInfo(),
    getChatWidgetSettings(),
    db.adminUser.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, role: true, twoFactorEnabled: true },
    }),
  ]);

  const self = staff.find((s) => s.id === admin.id);

  return (
    <SettingsView
      storeInfo={storeInfo}
      chatWidget={chatWidget}
      staff={staff}
      selfId={admin.id}
      twoFactorEnabled={self?.twoFactorEnabled ?? false}
    />
  );
}
