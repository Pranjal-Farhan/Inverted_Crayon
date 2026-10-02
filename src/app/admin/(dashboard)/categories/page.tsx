import { db } from "@/lib/db";
import { CategoryManager } from "@/components/admin/CategoryManager";

export default async function AdminCategoriesPage() {
  const categories = await db.category.findMany({
    orderBy: [{ gender: "asc" }, { position: "asc" }],
    include: { _count: { select: { products: true } } },
  });

  return <CategoryManager categories={categories} />;
}
