import { redirect } from "next/navigation";

/** Stock purchases are now recorded as investments (stock shipments) — keep old links and bookmarks working. */
export default function FinanceStockRedirect() {
  redirect("/admin/finance/investments");
}
