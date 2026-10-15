import Image from "next/image";
import { Monogram } from "@/components/brand/Monogram";
import { NewsletterForm } from "@/components/layout/NewsletterForm";
import { ScribbleLink } from "@/components/ui/ScribbleLink";
import { CrayonScribble } from "@/components/brand/CrayonScribble";

const VALUE_PROPS = [
  {
    title: "Fastest Shipping",
    body: "Anywhere, to your door.",
    color: "#ff2d84",
    icon: (
      <svg viewBox="0 0 24 24" stroke="#ff2d84" fill="none" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
      </svg>
    ),
  },
  {
    title: "Premium Quality",
    body: "Selected fabrics & prints.",
    color: "#26a7e6",
    icon: (
      <svg viewBox="0 0 24 24" stroke="#26a7e6" fill="none" strokeWidth="2">
        <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z" />
      </svg>
    ),
  },
  {
    title: "Quality After Sales Service",
    body: "Hassle-Free Return Policy.",
    color: "#c3f53a",
    icon: (
      <svg viewBox="0 0 24 24" stroke="#c3f53a" fill="none" strokeWidth="2">
        <path d="M4 8a8 8 0 0114-4M20 16a8 8 0 01-14 4" />
        <path d="M18 3v5h-5M6 21v-5h5" />
      </svg>
    ),
  },
  {
    title: "Secure Payments",
    body: "Encrypted checkout.",
    color: "#ff2d84",
    icon: (
      <svg viewBox="0 0 24 24" stroke="#ff2d84" fill="none" strokeWidth="2">
        <rect x="5" y="10" width="14" height="10" rx="1.5" />
        <path d="M8 10V7a4 4 0 018 0v3" />
      </svg>
    ),
  },
];

const LEGAL_LINKS = [
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function Footer({
  brandName = "Inverted Crayon",
  motto = "Stay Inverted",
  logoImageUrl = null,
  social = { facebookUrl: "", instagramUrl: "", whatsappUrl: "" },
}: {
  brandName?: string;
  motto?: string;
  logoImageUrl?: string | null;
  social?: { facebookUrl: string; instagramUrl: string; whatsappUrl: string };
}) {
  const [mottoFirst, ...mottoRest] = motto.split(" ");
  const mottoRestText = mottoRest.join(" ");
  return (
    <footer className="mt-10 border-t border-line bg-ink pb-8">
      <div className="wrap">
        <div className="grid grid-cols-2 desktop:grid-cols-4 gap-5 border-b border-line py-8">
          {VALUE_PROPS.map((v) => (
            <div key={v.title} className="flex gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2"
                style={{ borderColor: v.color }}
              >
                <span className="h-[18px] w-[18px]">{v.icon}</span>
              </span>
              <div>
                <h5 className="font-label text-base tracking-[1.4px]">{v.title}</h5>
                <p className="text-xs text-muted">{v.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-5 py-6">
          <CrayonScribble
            id="footer"
            color="var(--color-ic-cyan)"
            className="pointer-events-none absolute -top-2 right-0 hidden h-14 w-20 rotate-3 opacity-75 desktop:block"
          />
          <div className="flex items-center gap-3.5">
            {logoImageUrl ? (
              <Image src={logoImageUrl} alt={brandName} width={200} height={36} className="h-9 w-auto object-contain" />
            ) : (
              <Monogram className="h-8 w-9" />
            )}
            <div className="font-scrawl text-[30px] leading-[0.9] text-yellow">
              {mottoFirst}
              {mottoRestText && (
                <>
                  <br />
                  {mottoRestText}
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4.5">
            <NewsletterForm />
            <div className="flex gap-3.5">
              {social.facebookUrl && (
                <SocialIcon
                  href={social.facebookUrl}
                  label="Facebook"
                  path="M13.5 21v-7.6h2.6l.4-3h-3V8.3c0-.9.3-1.5 1.6-1.5h1.5V4.1C15.9 4 14.9 4 13.8 4c-2.6 0-4.3 1.6-4.3 4.4v2h-2.6v3h2.6V21h3z"
                />
              )}
              {social.instagramUrl && (
                <SocialIcon
                  href={social.instagramUrl}
                  label="Instagram"
                  path="M12 2c2.7 0 3 0 4.1.1 1 0 1.7.2 2.3.5.6.2 1.1.5 1.6 1s.8 1 1 1.6c.3.6.4 1.3.5 2.3.1 1.1.1 1.4.1 4.1s0 3-.1 4.1c0 1-.2 1.7-.5 2.3-.2.6-.5 1.1-1 1.6s-1 .8-1.6 1c-.6.3-1.3.4-2.3.5-1.1.1-1.4.1-4.1.1s-3 0-4.1-.1c-1 0-1.7-.2-2.3-.5-.6-.2-1.1-.5-1.6-1s-.8-1-1-1.6c-.3-.6-.4-1.3-.5-2.3C2 15 2 14.7 2 12s0-3 .1-4.1c0-1 .2-1.7.5-2.3.2-.6.5-1.1 1-1.6s1-.8 1.6-1c.6-.3 1.3-.4 2.3-.5C9 2 9.3 2 12 2zm0 5a5 5 0 100 10 5 5 0 000-10zm0 8a3 3 0 110-6 3 3 0 010 6zm5.3-8.9a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z"
                />
              )}
              {social.whatsappUrl && (
                <SocialIcon
                  href={social.whatsappUrl}
                  label="WhatsApp"
                  path="M17.5 14.4c-.3-.1-1.6-.8-1.9-.9-.2-.1-.4-.1-.6.1-.2.2-.6.9-.8 1-.1.2-.3.2-.5.1-1.4-.6-2.3-1.2-3.2-2.7-.2-.3 0-.5.1-.6.2-.2.4-.5.6-.7.1-.2.1-.4 0-.5-.1-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.4-.2.2-.9.9-.9 2.2 0 1.3.9 2.6 1 2.8.1.1 1.7 2.7 4.3 3.7 2.1.8 2.1.5 2.5.5.4 0 1.3-.5 1.5-1 .2-.5.2-.9.1-1 0-.1-.2-.2-.5-.3zM12 2a10 10 0 00-8.5 15.2L2 22l4.9-1.5A10 10 0 1012 2z"
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 border-t border-line pt-4">
          {LEGAL_LINKS.map((l) => (
            <ScribbleLink key={l.href} href={l.href} stroke="var(--color-ic-lime)" className="font-label text-[13px] tracking-[1px] text-muted hover:text-paper">
              {l.label}
            </ScribbleLink>
          ))}
        </div>
        <div className="mt-3 font-label text-xs tracking-[1px] text-muted-2">
          © 2026 INVERTED CRAYON · MADE TO STAND OUT
        </div>
      </div>
    </footer>
  );
}

function SocialIcon({ path, href, label }: { path: string; href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-paper">
        <path d={path} />
      </svg>
    </a>
  );
}
