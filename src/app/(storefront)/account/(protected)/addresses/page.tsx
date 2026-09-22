import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { AddressManager } from "@/components/storefront/AddressManager";

export default async function AccountAddressesPage() {
  const session = await getCustomerSession();
  const addresses = await db.address.findMany({ where: { customerId: session!.customerId }, orderBy: { isDefault: "desc" } });
  return <AddressManager addresses={addresses} />;
}
