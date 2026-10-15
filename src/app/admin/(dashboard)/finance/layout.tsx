import { FinanceNav } from "@/components/admin/finance/FinanceNav";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <FinanceNav />
      {children}
    </div>
  );
}
