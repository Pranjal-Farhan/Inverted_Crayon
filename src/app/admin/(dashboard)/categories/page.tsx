import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { CategoryManager } from "@/components/admin/CategoryManager";

export default async function AdminCategoriesPage() {
  await requireAdminPage("categories");
  const rows = await db.category.findMany({
    orderBy: [{ gender: "asc" }, { position: "asc" }],
    include: { _count: { select: { products: true, menProducts: true, womenProducts: true } } },
  });
  // A category's products: the ones whose own category it is, plus Unisex products also listed under it.
  const categories = rows.map(({ _count, ...c }) => ({ ...c, _count: { products: _count.products + _count.menProducts + _count.womenProducts } }));

  return <CategoryManager categories={categories} />;
}
