export type FooterSocialData = {
  facebookUrl: string;
  instagramUrl: string;
  whatsappUrl: string;
};

export const DEFAULT_FOOTER_SOCIAL: FooterSocialData = {
  facebookUrl: "",
  instagramUrl: "",
  whatsappUrl: "",
};

export type FaqItem = { q: string; a: string };

export type FaqPageData = {
  heading: string;
  items: FaqItem[];
};

export const DEFAULT_FAQ_PAGE: FaqPageData = {
  heading: "Help / FAQ",
  items: [
    { q: "When will my order ship?", a: "Within 24–48h from Dhaka. Delivery 2–5 days domestic." },
    {
      q: "How do preorders work?",
      a: "Preorder now and our sales agent will reach out to confirm the details — no advance payment needed online. Ships on the date shown on the product page.",
    },
    { q: "Which payments do you accept?", a: "bKash, cards via SSLCommerz, and cash on delivery." },
  ],
};

export type ContactPageData = {
  heading: string;
  intro: string;
  extraNote: string;
};

export const DEFAULT_CONTACT_PAGE: ContactPageData = {
  heading: "Contact",
  intro: "Questions, wholesale, press — reach us.",
  extraNote: "IG · WhatsApp · @invertedcrayon",
};

export type LegalSection = { title: string; body: string };

export type LegalPageData = {
  heading: string;
  lastUpdated: string;
  sections: LegalSection[];
};

export const DEFAULT_PRIVACY_PAGE: LegalPageData = {
  heading: "Privacy Policy",
  lastUpdated: "Last updated September 2026.",
  sections: [
    {
      title: "What we collect",
      body: "When you place an order, we collect your name, email, phone number, and shipping address. Guest checkout orders are identified by email — no password required. If you create an account, we also store your login credentials (hashed, never in plain text).",
    },
    {
      title: "How we use it",
      body: "Your details are used to fulfil and deliver orders, send order and shipping updates, respond to support requests, and — only if you opt in — send newsletter emails about drops and restocks. We never sell your data to third parties.",
    },
    {
      title: "Payments",
      body: "Payments are processed by bKash and SSLCommerz. We do not store your card, mobile banking PIN, or wallet credentials — those are handled directly by the payment gateway over an encrypted connection.",
    },
    {
      title: "Cookies & local storage",
      body: "Your shopping bag is stored in your browser's local storage so it persists between visits. We use this only to remember your bag — not to track you across other sites.",
    },
    {
      title: "Your rights",
      body: "You can request a copy of the data we hold on you, ask us to correct it, or ask us to delete your account and associated data, by contacting us at the email on our Contact page.",
    },
  ],
};

export const DEFAULT_TERMS_PAGE: LegalPageData = {
  heading: "Terms of Service",
  lastUpdated: "Last updated September 2026.",
  sections: [
    {
      title: "Orders & pricing",
      body: "All prices are listed in Bangladeshi Taka (৳) and include applicable taxes unless stated otherwise. We reserve the right to correct pricing errors and to cancel and refund orders placed at an incorrect price.",
    },
    {
      title: "Preorders",
      body: "Preorder now and our sales agent will reach out to confirm the details — no advance payment is required online. Ship dates are estimates and may shift; we'll email you if a date changes.",
    },
    {
      title: "Payments",
      body: "We accept bKash, card / mobile banking via SSLCommerz, and cash on delivery (where available). Cash on delivery orders may be limited by delivery area.",
    },
    {
      title: "Returns & refunds",
      body: "Unworn items with tags attached may be returned within 14 days of delivery. Start a return from your account or by contacting us.",
    },
    {
      title: "Intellectual property",
      body: "All designs, artwork, and the Inverted Crayon name and marks are the property of Inverted Crayon. Product images may not be reused without permission.",
    },
    { title: "Contact", body: "Questions about these terms? Reach us on the Contact page." },
  ],
};
