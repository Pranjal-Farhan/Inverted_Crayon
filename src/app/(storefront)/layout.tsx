import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { ChatBubble } from "@/components/layout/ChatBubble";
import { MarqueeTicker } from "@/components/layout/MarqueeTicker";
import { DEFAULT_HERO, type HeroData } from "@/lib/hero-defaults";
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
  const [campaigns, heroBlock, chatWidget, categories] = await Promise.all([
    getActiveCampaigns(),
    getContentBlock("home_hero"),
    getCachedChatWidgetSettings(),
    getNavCategories(),
  ]);
  const saleActive = campaigns.length > 0;
  const hero: HeroData = { ...DEFAULT_HERO, ...(heroBlock?.data as Partial<HeroData> | undefined) };

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
      <MarqueeTicker />
      <main className="wrap flex-1">{children}</main>
      <Footer brandName={hero.brandName} motto={hero.motto} logoImageUrl={hero.logoImageUrl} />
      <CartDrawer />
      <ChatBubble whatsappUrl={whatsappUrl} messengerUrl={messengerUrl} />
    </>
  );
}
