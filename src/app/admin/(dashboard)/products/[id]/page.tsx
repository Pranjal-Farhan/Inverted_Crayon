import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { ProductEditorForm } from "@/components/admin/ProductEditorForm";

type Props = { params: Promise<{ id: string }> };

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const [product, categories, collections] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: { variants: true, collections: true, tags: { include: { tag: true } }, images: { orderBy: { position: "asc" } } },
    }),
    db.category.findMany({ orderBy: { position: "asc" } }),
    db.collection.findMany({ orderBy: { title: "asc" } }),
  ]);
  if (!product) notFound();

  const preorderTag = product.tags.find((t) => t.tag.type === "PREORDER");
  const preorderMeta = preorderTag?.meta as { shipDate?: string } | null | undefined;

  return (
    <ProductEditorForm
      initial={{
        id: product.id,
        title: product.title,
        slug: product.slug,
        description: product.description,
        gender: product.gender,
        categoryId: product.categoryId,
        basePrice: toNumber(product.basePrice),
        status: product.status,
        freeDelivery: product.freeDelivery,
        seoTitle: product.seoTitle ?? undefined,
        seoDescription: product.seoDescription ?? undefined,
        collectionIds: product.collections.map((c) => c.collectionId),
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
        })),
        images: product.images,
      }}
      categories={categories}
      collections={collections.map((c) => ({ id: c.id, title: c.title }))}
    />
  );
}
