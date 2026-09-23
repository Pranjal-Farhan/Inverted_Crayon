import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/session";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { DEFAULT_HERO, type HeroData } from "@/lib/hero-defaults";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const now = new Date();
  const [activeCampaign, session, heroBlock] = await Promise.all([
    db.campaign.findFirst({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } } }),
    getCustomerSession(),
    db.contentBlock.findUnique({ where: { key: "home_hero" } }),
  ]);
  const hero: HeroData = { ...DEFAULT_HERO, ...(heroBlock?.data as Partial<HeroData> | undefined) };

  return (
    <>
      <Header
        saleActive={Boolean(activeCampaign)}
        customerName={session?.name ?? null}
        brandName={hero.brandName}
        logoImageUrl={hero.logoImageUrl}
      />
      <main className="wrap flex-1">{children}</main>
      <Footer brandName={hero.brandName} motto={hero.motto} logoImageUrl={hero.logoImageUrl} />
      <CartDrawer />
    </>
  );
}
