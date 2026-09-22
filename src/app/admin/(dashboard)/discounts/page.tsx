import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { DiscountManager } from "@/components/admin/DiscountManager";

export default async function AdminDiscountsPage() {
  const discounts = await db.discount.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <DiscountManager
      discounts={discounts.map((d) => ({
        id: d.id,
        code: d.code,
        type: d.type,
        value: toNumber(d.value),
        minSpend: d.minSpend != null ? toNumber(d.minSpend) : null,
        firstOrderOnly: d.firstOrderOnly,
        usageLimit: d.usageLimit,
        usedCount: d.usedCount,
        active: d.active,
      }))}
    />
  );
}
