import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/session";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const now = new Date();
  const [activeCampaign, session] = await Promise.all([
    db.campaign.findFirst({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } } }),
    getCustomerSession(),
  ]);

  return (
    <>
      <Header saleActive={Boolean(activeCampaign)} customerName={session?.name ?? null} />
      <main className="wrap flex-1">{children}</main>
      <Footer />
      <CartDrawer />
    </>
  );
}
