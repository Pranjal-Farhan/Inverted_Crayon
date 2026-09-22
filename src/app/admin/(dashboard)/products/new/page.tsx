import { db } from "@/lib/db";
import { ProductEditorForm } from "@/components/admin/ProductEditorForm";

export default async function NewProductPage() {
  const [categories, collections] = await Promise.all([
    db.category.findMany({ orderBy: { position: "asc" } }),
    db.collection.findMany({ orderBy: { title: "asc" } }),
  ]);

  return (
    <ProductEditorForm
      initial={null}
      categories={categories}
      collections={collections.map((c) => ({ id: c.id, title: c.title }))}
    />
  );
}
