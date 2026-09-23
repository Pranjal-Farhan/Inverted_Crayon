import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { CampaignManager } from "@/components/admin/CampaignManager";
import { AbandonedCheckoutPanel } from "@/components/admin/AbandonedCheckoutPanel";
import type { CartLine } from "@/lib/cart-types";

export default async function AdminCampaignsPage() {
  const [campaigns, categories, abandoned] = await Promise.all([
    db.campaign.findMany({ orderBy: { startsAt: "desc" } }),
    db.category.findMany({ orderBy: { position: "asc" } }),
    db.abandonedCheckout.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const catById = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  return (
    <div>
      <CampaignManager
        categories={categories}
        campaigns={campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          percentOff: c.percentOff != null ? toNumber(c.percentOff) : null,
          targetCategoryId: c.targetCategoryId,
          targetCategoryName: c.targetCategoryId ? (catById[c.targetCategoryId] ?? null) : null,
          startsAt: c.startsAt.toISOString(),
          endsAt: c.endsAt.toISOString(),
          active: c.active,
        }))}
      />
      <div className="mt-4.5">
        <AbandonedCheckoutPanel
          rows={abandoned.map((a) => {
            const lines = a.cartSnapshot as unknown as Pick<CartLine, "qty" | "unitPrice">[];
            return {
              id: a.id,
              email: a.email,
              total: lines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
              itemCount: lines.reduce((s, l) => s + l.qty, 0),
              createdAt: a.createdAt.toISOString(),
              remindedAt: a.remindedAt?.toISOString() ?? null,
            };
          })}
        />
      </div>
    </div>
  );
}
