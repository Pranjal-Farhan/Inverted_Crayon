import { requireAdminPage } from "@/lib/admin-guard";
import { canAccessArea } from "@/lib/admin-areas";
import { db } from "@/lib/db";
import { ProductEditorForm } from "@/components/admin/ProductEditorForm";
import { parseSizeGuide, type SizeGuideTemplateOption } from "@/lib/size-guide";
import { getProductLockedCouponOptions } from "@/lib/coupon-options";
import { getShippingRates } from "@/lib/store-settings";

export default async function NewProductPage() {
  const admin = await requireAdminPage("products");
  const [categories, sizeGuideTemplateRows, couponOptions, rates] = await Promise.all([
    db.category.findMany({ orderBy: [{ gender: "asc" }, { position: "asc" }] }),
    db.sizeGuideTemplate.findMany({ orderBy: { name: "asc" } }),
    getProductLockedCouponOptions(),
    getShippingRates(),
  ]);
  const sizeGuideTemplates: SizeGuideTemplateOption[] = sizeGuideTemplateRows.flatMap((row) => {
    const data = parseSizeGuide(row.data);
    return data ? [{ id: row.id, name: row.name, data }] : [];
  });

  // key="new" plus [id]/page.tsx's key={product.id} forces React to mount a fresh
  // ProductEditorForm instance per product. Without it, navigating between two products'
  // edit pages via <Link> (soft nav, same route component) reuses the existing instance —
  // React only runs useState's initializer on first mount, so every field (title, tags,
  // variants, images) would keep showing whichever product was open first.
  return (
    <ProductEditorForm
      key="new"
      initial={null}
      categories={categories}
      sizeGuideTemplates={sizeGuideTemplates}
      couponOptions={couponOptions}
      standardDelivery={{ insideDhaka: rates.INSIDE_DHAKA.cost, outsideDhaka: rates.OUTSIDE_DHAKA.cost }}
      canSeePurchaseCost={canAccessArea(admin.role, "finance")}
    />
  );
}
