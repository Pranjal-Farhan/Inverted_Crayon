import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { ChatBubble } from "@/components/layout/ChatBubble";
import { MarqueeTicker } from "@/components/layout/MarqueeTicker";
import { DEFAULT_HERO, type HeroData } from "@/lib/hero-defaults";
import { DEFAULT_MARQUEE, type MarqueeData } from "@/lib/marquee-defaults";
import { DEFAULT_FOOTER_SOCIAL, type FooterSocialData } from "@/lib/footer-defaults";
import {
  getCachedChatWidgetSettings,
  getContentBlock,
  getNavCategories,
  getSaleActive,
} from "@/lib/public-cache";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  // None of these read cookies()/headers() — logged-in state is shown client-side (see
  // src/lib/use-logged-in.ts) so this layout's output is identical for every visitor and the
  // ~60 public routes under it can be static/ISR instead of forced dynamic by a session check.
  const [saleActive, heroBlock, marqueeBlock, socialBlock, chatWidget, categories] = await Promise.all([
    getSaleActive(),
    getContentBlock("home_hero"),
    getContentBlock("home_marquee"),
    getContentBlock("footer_social"),
    getCachedChatWidgetSettings(),
    getNavCategories(),
  ]);
  const hero: HeroData = { ...DEFAULT_HERO, ...(heroBlock?.data as Partial<HeroData> | undefined) };
  const marquee: MarqueeData = { ...DEFAULT_MARQUEE, ...(marqueeBlock?.data as Partial<MarqueeData> | undefined) };
  const social: FooterSocialData = { ...DEFAULT_FOOTER_SOCIAL, ...(socialBlock?.data as Partial<FooterSocialData> | undefined) };

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
      <Footer brandName={hero.brandName} motto={hero.motto} logoImageUrl={hero.logoImageUrl} social={social} />
      <CartDrawer />
      <ChatBubble whatsappUrl={whatsappUrl} messengerUrl={messengerUrl} />
    </>
  );
}
