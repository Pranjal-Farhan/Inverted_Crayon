import { requireAdminPage } from "@/lib/admin-guard";
import { canAccessArea } from "@/lib/admin-areas";
import { InventoryManager } from "@/components/admin/inventory/InventoryManager";
import { loadInventory } from "@/lib/inventory";
import { stockLedgerMismatches } from "@/lib/stock";

/**
 * Inventory: every product with its sizes and counts, what the stock cost to buy and what it will
 * fetch when sold, and quick stock updates. Buying cost is shown to admins only — it is never sent
 * to a staff account.
 */
export default async function InventoryPage() {
  const admin = await requireAdminPage("inventory");
  const isAdmin = canAccessArea(admin.role, "finance");
  const [products, mismatches] = await Promise.all([loadInventory({ includeCost: isAdmin }), stockLedgerMismatches()]);
  return <InventoryManager products={products} canSeeCost={isAdmin} mismatches={mismatches.map((m) => `${m.productTitle} — ${m.variantLabel} (${m.sku}): count ${m.stockQty}, history ${m.ledger}`)} />;
}
