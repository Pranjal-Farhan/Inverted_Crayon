import { redirect } from "next/navigation";
import { getCustomerSession, clearCustomerSession } from "@/lib/session";
import { AccountNav } from "@/components/storefront/AccountNav";

export default async function AccountProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession();
  // A session that fails verify here (expired, tampered, or a rotated SESSION_SECRET) but whose
  // cookie the browser hasn't dropped yet would otherwise leave the non-httpOnly hint cookie
  // behind — the header's useLoggedIn() would keep showing "logged in" while every account page
  // bounces to /account/login. Clearing both here, not just the httpOnly one, keeps that hint
  // in lockstep with the real session on every expiry path, not just explicit logout.
  if (!session) {
    await clearCustomerSession();
    redirect("/account/login");
  }

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
