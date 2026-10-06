import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/session";
import { AccountNav } from "@/components/storefront/AccountNav";

export default async function AccountProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getCustomerSession();
  // Deliberately NOT clearing the hint cookie here even though session is invalid — Next.js
  // forbids cookies().set()/delete() during a Server Component render (only Server Actions and
  // Route Handlers may mutate cookies); calling clearCustomerSession() from this layout throws
  // "Cookies can only be modified in a Server Action or Route Handler" and breaks the redirect
  // entirely (confirmed live — it took down every /account/* page). See the Task 4 writeup for
  // why this is still safe: setCustomerSession() always sets both cookies with the same
  // MAX_AGE_SECONDS in the same response, so outside of a forced SESSION_SECRET rotation or a
  // tampered cookie, they expire from the browser at the exact same instant with no server code
  // needed. The only real gap (secret rotation) leaves a non-identifying hint cookie stale for
  // at most its remaining maxAge while every account page still correctly bounces here.
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
