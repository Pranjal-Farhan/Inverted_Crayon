import type { Metadata } from "next";
import { GenderHub } from "@/components/storefront/GenderHub";

export const metadata: Metadata = { title: "Men" };
export const revalidate = 3600;

export default function MenHubPage() {
  return <GenderHub gender="MEN" />;
}
