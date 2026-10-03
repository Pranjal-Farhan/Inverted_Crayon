import { db } from "@/lib/db";
import { parseSizeGuide, type SizeGuideTemplateOption } from "@/lib/size-guide";
import { SizeGuideTemplateManager } from "@/components/admin/SizeGuideTemplateManager";

export default async function AdminSizeGuidesPage() {
  const rows = await db.sizeGuideTemplate.findMany({ orderBy: { name: "asc" } });

  // Defensive: a template's own saveSizeGuideTemplate() action already validates its shape, so
  // this should never actually drop anything — parseSizeGuide is reused here only so a future
  // hand-edited/malformed row can't crash the page.
  const templates: SizeGuideTemplateOption[] = rows.flatMap((row) => {
    const data = parseSizeGuide(row.data);
    return data ? [{ id: row.id, name: row.name, data }] : [];
  });

  return <SizeGuideTemplateManager templates={templates} />;
}
