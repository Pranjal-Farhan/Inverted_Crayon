import { db } from "@/lib/db";
import { Panel } from "@/components/admin/Panel";
import { CollectionManager } from "@/components/admin/CollectionManager";

export default async function AdminCategoriesPage() {
  const [categories, collections] = await Promise.all([
    db.category.findMany({ orderBy: { position: "asc" } }),
    db.collection.findMany({ orderBy: { title: "asc" }, include: { _count: { select: { products: true } } } }),
  ]);

  return (
    <div>
      <Panel title="Categories (both genders)">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.id} className="border border-lime px-2.5 py-1 text-sm text-lime">
              {c.name}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Each category renders for Men and Women via URL context (/men/{"{category}"} and /women/{"{category}"}).
          The category set is shared across both genders per the locked navigation model.
        </p>
      </Panel>

      <div className="mt-4.5">
        <CollectionManager collections={collections} />
      </div>
    </div>
  );
}
