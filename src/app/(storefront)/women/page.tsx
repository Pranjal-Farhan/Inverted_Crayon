import type { Metadata } from "next";
import { GenderHub } from "@/components/storefront/GenderHub";

export const metadata: Metadata = { title: "Women" };
export const revalidate = 3600;

export default function WomenHubPage() {
  return <GenderHub gender="WOMEN" />;
}
