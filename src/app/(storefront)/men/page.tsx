import type { Metadata } from "next";
import { GenderHub } from "@/components/storefront/GenderHub";

export const metadata: Metadata = { title: "Men" };

export default function MenHubPage() {
  return <GenderHub gender="MEN" />;
}
