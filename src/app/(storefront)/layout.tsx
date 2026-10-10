import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { ChatBubble } from "@/components/layout/ChatBubble";
import { MarqueeTicker } from "@/components/layout/MarqueeTicker";
import { DEFAULT_HERO, type HeroData } from "@/lib/hero-defaults";
import { DEFAULT_MARQUEE, type MarqueeData } from "@/lib/marquee-defaults";
import {
  getActiveCampaigns,
  getCachedChatWidgetSettings,
  getContentBlock,
  getNavCategories,
} from "@/lib/public-cache";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  // None of these read cookies()/headers() — logged-in state is shown client-side (see
  // src/lib/use-logged-in.ts) so this layout's output is identical for every visitor and the
  // ~60 public routes under it can be static/ISR instead of forced dynamic by a session check.
  //
  // getActiveCampaigns() carries a revalidate: 300 option (src/lib/public-cache.ts) — the
  // header's `saleActive` dot is itself campaign-derived and shared on every storefront page, so
  // a scheduled campaign boundary needs the same 5-minute-or-less staleness ceiling there too.
  // Because this layout wraps every page under it, that 300s also becomes the effective ceiling
  // for every child page's own ISR regeneration (Next.js takes the lowest revalidate across the
  // layouts and page of a route) — including pages like /journal or /lookbook that have no
  // campaign-derived content of their own and would otherwise be fine at a longer window. That's
  // an acceptable, intentional trade: a handful of pages regenerate a bit more often than their
  // own content strictly requires, in exchange for the header's sale indicator never being
  // allowed to drift for longer than 5 minutes anywhere on the site.
  const [campaigns, heroBlock, marqueeBlock, chatWidget, categories] = await Promise.all([
    getActiveCampaigns(),
    getContentBlock("home_hero"),
    getContentBlock("home_marquee"),
    getCachedChatWidgetSettings(),
    getNavCategories(),
  ]);
  const saleActive = campaigns.length > 0;
  const hero: HeroData = { ...DEFAULT_HERO, ...(heroBlock?.data as Partial<HeroData> | undefined) };
  const marquee: MarqueeData = { ...DEFAULT_MARQUEE, ...(marqueeBlock?.data as Partial<MarqueeData> | undefined) };

  const whatsappDigits = chatWidget.whatsappNumber.replace(/[^0-9]/g, "");
  const whatsappUrl =
    chatWidget.enabled && whatsappDigits
      ? `https://wa.me/${whatsappDigits}${chatWidget.whatsappMessage ? `?text=${encodeURIComponent(chatWidget.whatsappMessage)}` : ""}`
      : null;
  const messengerUrl =
    chatWidget.enabled && chatWidget.messengerUsername.trim()
      ? `https://m.me/${chatWidget.messengerUsername.trim()}`
      : null;

  return (
    <>
      <div className="site-wall" aria-hidden="true" />
      <div className="site-grain" aria-hidden="true" />
      <Header
        saleActive={saleActive}
        brandName={hero.brandName}
        logoImageUrl={hero.logoImageUrl}
        categories={categories}
      />
      <MarqueeTicker lines={marquee.lines} />
      <main className="wrap flex-1">{children}</main>
      <Footer brandName={hero.brandName} motto={hero.motto} logoImageUrl={hero.logoImageUrl} />
      <CartDrawer />
      <ChatBubble whatsappUrl={whatsappUrl} messengerUrl={messengerUrl} />
    </>
  );
}
