import { db } from "@/lib/db";
import { ProductEditorForm } from "@/components/admin/ProductEditorForm";

export default async function NewProductPage() {
  const categories = await db.category.findMany({ orderBy: [{ gender: "asc" }, { position: "asc" }] });

  // key="new" plus [id]/page.tsx's key={product.id} forces React to mount a fresh
  // ProductEditorForm instance per product. Without it, navigating between two products'
  // edit pages via <Link> (soft nav, same route component) reuses the existing instance —
  // React only runs useState's initializer on first mount, so every field (title, tags,
  // variants, images) would keep showing whichever product was open first.
  return <ProductEditorForm key="new" initial={null} categories={categories} />;
}
