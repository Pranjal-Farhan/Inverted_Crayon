import type { Metadata } from "next";
import { GenderHub } from "@/components/storefront/GenderHub";

export const metadata: Metadata = { title: "Women" };
// 300s — see the matching comment on src/app/(storefront)/men/page.tsx.
export const revalidate = 300;

export default function WomenHubPage() {
  return <GenderHub gender="WOMEN" />;
}
