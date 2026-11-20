import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin-guard";
import { ProductImportForm } from "@/components/admin/ProductImportForm";

export const metadata: Metadata = { title: "Import products" };

// Each product is created by its own request (see ProductImportForm), but a single one with dozens of
// sizes still does a few hundred small writes — give it the room the host allows.
export const maxDuration = 60;

export default async function ImportProductsPage() {
  await requireAdminPage("products");
  return <ProductImportForm />;
}
