import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/storefront/ProfileForm";

export default async function AccountProfilePage() {
  const session = await getCustomerSession();
  // Verified independently of the (protected) layout's own redirect — see the Task 3 audit in
  // PERF-REPORT-2.txt for why every account data read checks this itself rather than trusting
  // the layout: Next.js evaluates a layout and its page concurrently, so a page that instead
  // used session!.customerId could still run (and throw) before the layout's redirect() wins.
  if (!session) redirect("/account/login");
  const customer = await db.customer.findUnique({
    where: { id: session.customerId },
    include: { addresses: { where: { isDefault: true } } },
  });
  const defaultAddress = customer?.addresses[0];

  return (
    <div>
      <ProfileForm
        name={customer?.name ?? ""}
        phone={customer?.phone ?? ""}
        email={customer?.email ?? ""}
        avatarUrl={customer?.avatarUrl ?? null}
      />
      <div className="mt-4.5 border border-line bg-panel p-4.5">
        <h3 className="font-impact mb-2 text-lg uppercase">Default address</h3>
        {defaultAddress ? (
          <p className="text-sm text-muted">
            {defaultAddress.line1}, {defaultAddress.area} · {defaultAddress.district} {defaultAddress.postcode} · {defaultAddress.country}
          </p>
        ) : (
          <p className="text-sm text-muted">No default address saved yet.</p>
        )}
      </div>
    </div>
  );
}
