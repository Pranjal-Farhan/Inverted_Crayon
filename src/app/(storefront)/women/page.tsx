import type { Metadata } from "next";
import { GenderHub } from "@/components/storefront/GenderHub";

export const metadata: Metadata = { title: "Women" };

export default function WomenHubPage() {
  return <GenderHub gender="WOMEN" />;
}
