import { db } from "@/lib/db";
import { ProductEditorForm } from "@/components/admin/ProductEditorForm";

export default async function NewProductPage() {
  const categories = await db.category.findMany({ orderBy: [{ gender: "asc" }, { position: "asc" }] });

  return <ProductEditorForm initial={null} categories={categories} />;
}
