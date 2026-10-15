import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { CampaignManager } from "@/components/admin/CampaignManager";

export default async function AdminCampaignsPage() {
  const [campaigns, categories] = await Promise.all([
    db.campaign.findMany({ orderBy: { startsAt: "desc" } }),
    db.category.findMany({ orderBy: [{ gender: "asc" }, { position: "asc" }] }),
  ]);
  const catById = Object.fromEntries(categories.map((c) => [c.id, c.name]));
  const branchLabel = { MEN: "Men", WOMEN: "Women", UNISEX: "Unisex" } as const;

  return (
    <div>
      <CampaignManager
        categories={categories.map((c) => ({ id: c.id, name: `${c.name} (${branchLabel[c.gender]})` }))}
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
    </div>
  );
}
