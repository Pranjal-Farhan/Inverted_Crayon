import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { ProductEditorForm } from "@/components/admin/ProductEditorForm";
import { parseSizeGuide, type SizeGuideTemplateOption } from "@/lib/size-guide";

type Props = { params: Promise<{ id: string }> };

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const [product, categories, sizeGuideTemplateRows] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: { variants: true, tags: { include: { tag: true } }, images: { orderBy: { position: "asc" } } },
    }),
    db.category.findMany({ orderBy: [{ gender: "asc" }, { position: "asc" }] }),
    db.sizeGuideTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!product) notFound();

  const sizeGuideTemplates: SizeGuideTemplateOption[] = sizeGuideTemplateRows.flatMap((row) => {
    const data = parseSizeGuide(row.data);
    return data ? [{ id: row.id, name: row.name, data }] : [];
  });

  const preorderTag = product.tags.find((t) => t.tag.type === "PREORDER");
  const preorderMeta = preorderTag?.meta as { shipDate?: string } | null | undefined;

  return (
    <ProductEditorForm
      // See new/page.tsx's key="new" for why this is required — without it, clicking from one
      // product's edit page to another's (soft nav, same route component) leaves every field
      // showing stale data from whichever product this form instance first mounted with.
      key={product.id}
      initial={{
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        categoryId: product.categoryId,
        basePrice: toNumber(product.basePrice),
        status: product.status,
        freeDelivery: product.freeDelivery,
        seoTitle: product.seoTitle ?? undefined,
        seoDescription: product.seoDescription ?? undefined,
        tagNew: product.tags.some((t) => t.tag.type === "NEW"),
        tagPreorder: Boolean(preorderTag),
        preorderShipDate: preorderMeta?.shipDate ?? "",
        tagLimited: product.tags.some((t) => t.tag.type === "LIMITED"),
        tagBestseller: product.tags.some((t) => t.tag.type === "BESTSELLER"),
        variants: product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          colorHex: v.colorHex ?? "#0c0c0d",
          stockQty: v.stockQty,
          lowStockThreshold: v.lowStockThreshold,
          priceOverride: v.priceOverride != null ? toNumber(v.priceOverride) : null,
          preorderAdvanceAmount: v.preorderAdvanceAmount != null ? toNumber(v.preorderAdvanceAmount) : null,
        })),
        images: product.images,
        sizeGuide: parseSizeGuide(product.sizeGuide),
      }}
      categories={categories}
      sizeGuideTemplates={sizeGuideTemplates}
    />
  );
}
