import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/session";
import { AccountNav } from "@/components/storefront/AccountNav";

export default async function AccountProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");

  return (
    <section className="pg pb-16">
      <div className="pt-8 pb-1.5">
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">
          My <span className="text-lime">Account</span>
        </h1>
      </div>
      <div className="grid grid-cols-1 gap-7 py-5.5 desktop:grid-cols-[200px_1fr]">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
