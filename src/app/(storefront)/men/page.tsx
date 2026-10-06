import type { Metadata } from "next";
import { GenderHub } from "@/components/storefront/GenderHub";

export const metadata: Metadata = { title: "Men" };
// 300s, not 3600s — see the matching comment on src/app/(storefront)/page.tsx. GenderHub shows
// campaign-derived sale pricing, which a scheduled campaign boundary can change with no admin
// action to trigger an eager revalidateTag.
export const revalidate = 300;

export default function MenHubPage() {
  return <GenderHub gender="MEN" />;
}
