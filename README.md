# Inverted Crayon

Streetwear storefront + admin, built from the [Build Specification v1.0](.) — Next.js 16 (App Router), TypeScript, Tailwind v4, Prisma 7 / PostgreSQL.

**This is the quickstart.** For the full architecture — every model, every route, every server action, how they connect, and the design philosophy behind all of it — see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack, Server Actions)
- **Database**: PostgreSQL via Prisma 7 (`@prisma/adapter-pg` driver adapter)
- **Styling**: Tailwind CSS v4, design tokens in `src/app/globals.css` matching Build Spec §02–§04
- **Auth**: Signed JWT session cookies (`jose`) — separate admin and customer sessions. Email/password always works; Google and Facebook sign-in work too once you add OAuth credentials (see below) — until then the buttons bounce back with a clear message instead of erroring. Admin/staff accounts can additionally turn on TOTP two-factor authentication (Google Authenticator-compatible) from `/admin/settings` → Security.
- **Payments**: bKash and SSLCommerz (cards/mobile banking) are wired for real and go live the moment you add real merchant credentials (see below) — but are currently **commented out at checkout** (`CheckoutView.tsx`/`checkout.ts`), so **cash on delivery is the only option offered right now**, for every order including preorders with a configured advance (nothing is captured online; the advance is just collected as part of the COD total at delivery).
- **Emails**: Every "send" always writes to an `EmailLog` outbox (viewable at `/admin/emails`); add a Resend API key (see below) and it also actually sends. See `src/lib/mail.ts`.
- **Order-confirmation SMS**: same outbox pattern as email — every confirmed order writes to an `SmsLog` outbox (viewable at `/admin/sms`); add SSL Wireless credentials (see below) and it also actually sends. See `src/lib/sms.ts`.
- **Image hosting**: Product photos, the CMS logo, and hero images upload to ImgBB when `IMGBB_API_KEY` is set. The database stores the returned CDN URL instead of Base64 or local files.

## Getting started

```bash
npm install

# copy and fill in .env — needs a running Postgres instance
cp .env.example .env

npx prisma migrate dev   # creates tables
npx prisma db seed       # seeds catalog, orders, admin/customer test accounts, journal posts

npm run dev              # http://localhost:3000
```

### Test accounts (from seed)

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@invertedcrayon.com` | `StandOut123!` |
| Staff | `staff@invertedcrayon.com` | `StaffPass123!` |
| Customer | `rex@example.com` | `Password123!` |

Admin panel: `/admin/login`. Customer account: `/account/login`.

## Going live: third-party integrations

Everything below is fully wired in code and falls back to a safe mock when its env vars are unset — local dev needs none of this. Add credentials to `.env` (see `.env.example`) to switch each one on for real:

| Feature | Env vars | Where to get them |
| --- | --- | --- |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth client. Authorized redirect URI: `<your-site>/api/auth/google/callback` |
| Facebook sign-in | `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | Facebook Developers → your app's Facebook Login product. Valid OAuth redirect URI: `<your-site>/api/auth/facebook/callback` |
| bKash payments | `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, optional `BKASH_BASE_URL` | bKash merchant/PGW onboarding. Defaults to bKash's sandbox host |
| Card / mobile banking | `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, optional `SSLCOMMERZ_SANDBOX=false` for production | SSLCommerz merchant account. Sandbox credentials work against the sandbox host by default |
| Real email delivery | `RESEND_API_KEY`, `EMAIL_FROM` | resend.com — `EMAIL_FROM` must be a verified sender/domain on that account |
| Real SMS delivery | `SSLWIRELESS_SMS_API_TOKEN`, `SSLWIRELESS_SMS_SID`, optional `SSLWIRELESS_SMS_BASE_URL` | SSL Wireless SMS Plus — `SSLWIRELESS_SMS_SID` is your approved Sender ID |
| Image hosting | `IMGBB_API_KEY` | imgbb.com — create an API key in your account settings |
| Payment-gateway callback URLs | `SITE_URL` (e.g. `https://yourstore.com`) | Recommended in production so callback URLs are stable and correct behind any proxy; without it the app derives the origin from request headers |

Google/Facebook sign-in for **admin and staff accounts** only ever logs in to an account that already exists (matched by email) — it never self-registers a new admin, so there's no privilege-escalation path from someone else's OAuth login. Customer sign-in, by contrast, creates a new customer account on first login, same as registering with a password.

## Deploying to a real server

- **`SESSION_SECRET` is required in production** — the app refuses to start without it (`src/lib/session.ts`) rather than silently signing session cookies with a well-known fallback. Generate one with `openssl rand -base64 48`.
- **`DATABASE_URL`** must point at your production Postgres (managed providers' `?sslmode=require` connection strings work as-is). The app also refuses to start without it.
- **Don't run `npx prisma db seed` against production** — it's a demo dataset with known test-account passwords (see the table above) and refuses to run when `NODE_ENV=production` unless you explicitly set `ALLOW_PRODUCTION_SEED=true` (and, for the admin account specifically, `ADMIN_EMAIL`/`ADMIN_PASSWORD` of your choosing). Run `npx prisma migrate deploy` to apply the schema instead, then create your real admin user by hand.
- **Admin/customer login lock out after 5 failed attempts** for 15 minutes per account (`src/lib/login-lockout.ts`) — there's no rate limiting in front of the app otherwise (no WAF/CDN assumed), so this is the only brute-force guard.
- **Security headers** (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, a permissive-by-default `Permissions-Policy`, and HSTS when served over HTTPS) are set for every response in `src/proxy.ts`. No CSP is set — add one if you need it, testing carefully since a wrong CSP silently breaks pages rather than erroring.
- **Checkout is safe under concurrent load**: stock decrements and discount-code redemptions use guarded atomic updates inside the order transaction (not read-then-write), so two simultaneous checkouts for the last unit of stock (or the last use of a limited coupon) can't both succeed — one gets a clear "not enough stock" / "code fully redeemed" error instead of silently overselling.
- **Product photo uploads use ImgBB** when `IMGBB_API_KEY` is configured (up to 20 images per product). The homepage logo and hero-carousel uploads under `/admin/content` use the same ImgBB integration. Existing Base64 or legacy local-file URLs remain readable, but new uploads are stored as CDN URLs.

## Project structure

```
prisma/schema.prisma          data model (§10 of the spec, extended)
prisma/seed.ts                catalog + orders + accounts + journal posts seed
src/app/(storefront)/         public site — home, PLP/PDP, cart, checkout, account, journal, legal
src/app/admin/                admin app — dashboard, orders, products, inventory, CRM, journal, emails, settings
src/actions/                  server actions (checkout, admin CRUD, auth, mail-triggering events)
src/components/                brand, ui, layout, storefront, admin component libraries
src/lib/                      domain logic — tag/pricing derivation, cart, sessions, settings, mail
```

## Build phases

Both P1 (launch-critical) and P2 (fast-follow) from the spec's §13 checklist are implemented in full, including every item originally listed but not elaborated on in the page-by-page spec (journal/blog, abandoned-checkout + lifecycle emails, staff roles management):

- **P1**: design system, storefront browse/PDP, cart → guest checkout → confirmation → track order, admin dashboard/orders/products/inventory/categories/settings (including Tax and Email-template tabs), all legal/utility pages.
- **P2**: customer accounts (register/login/orders/returns/wishlist/back-in-stock — guest orders auto-claim on registration), reviews (customer-submitted from delivered orders → admin moderation → shown on PDP), drops/collections landing, lookbook, journal/blog, live search suggestions, a "recently viewed" rail, a swipeable multi-image PDP gallery, admin CRM/discounts/campaigns/content CMS/analytics/reviews/staff-roles CRUD, and the full lifecycle email set (order confirmed/shipped, back-in-stock, preorder ship-date changes, newsletter welcome, contact acknowledgement, abandoned-checkout reminders).

## Homepage CMS

`/admin/content` → **Brand identity** and **Homepage hero** panels control, without a code deploy: the logo image (falls back to the drawn monogram + wordmark when unset), brand name, motto (shown in the footer), the hero eyebrow/headline/sub-copy/badge text, a hero background color override, and a hero image carousel (falls back to a styled placeholder when empty). All of it renders live on `/` and in the header/footer immediately after publishing.

## Preorders — admin-set advance, not a customer choice

Any size/color becomes a preorder **the moment it sells out**, if you've set a **Preorder ৳** advance for it in that product's editor (per row in the variant table) — blank means it just stays "sold out", any set amount (including `0`) means it keeps selling. This covers two cases with one mechanism: a genuinely pre-launch product (every size starts at 0 stock, tag it **Preorder** in the Tags panel too for the ship-date banner) and an ordinary product where one size just ran out (no tag needed — it flashes a "Preorder — ships in 7–15 days · Free delivery" banner and stays purchasable automatically).

The advance is **per unit**, admin-set, not something the customer picks at checkout — `0` means free to reserve, everything due on delivery; a nonzero advance is still tracked the same way, but (while bKash/card are commented out — see below) it's never captured online: it just becomes part of what's collected as cash on delivery alongside the rest of the order. Admins see and mark the outstanding balance collected from the order-detail page's **Mark COD balance collected** button, and the exact advance-paid/balance-due split shows up on the customer's order confirmation, the SMS, the confirmation email, and the printable receipt.

> **bKash / card checkout is currently commented out.** `CheckoutView.tsx` only ever offers **Cash on delivery**, and `placeOrder()` rejects a direct `BKASH`/`SSLCOMMERZ` submission server-side too — both reversibly, pending re-enabling. COD works for every cart, preorders included, regardless of any configured advance.

## Order-confirmation SMS

Every confirmed order texts the customer's contact number (the "Phone (delivery SMS)" field from checkout) with order details, amount, and delivery location — content differs by how the order is paid:

- **Full paid** (bKash/card, nothing outstanding): order number, item(s), total paid, shipping location.
- **Cash on delivery**: order number, item(s), total due at delivery, delivery location.
- **Preorder partial payment**: order number, item(s), advance amount paid online, balance due as COD, delivery location.

Fires at every point an order actually becomes confirmed: the instant-paid/COD path in `placeOrder`, and both the bKash and SSLCommerz payment-success callbacks. Like email, it's mocked by default (every "send" lands in the `SmsLog` outbox at `/admin/sms`) and switches to real delivery once SSL Wireless credentials are set (see above).

## Free delivery tags

Each product's admin editor (Organize panel) has a **Free delivery** field — None / Inside Dhaka / Nationwide — that renders as a tag on that product's PDP next to Add to cart. Purely informational (it doesn't currently zero out the shipping line at checkout, which is calculated per-order from the shipping zone).

## Per-product size guide

Each product's admin editor has a **Size guide** panel (`Product.sizeGuide`, a JSON column — `src/lib/size-guide.ts`): a table of measurement columns you name yourself (defaults to Chest/Length/Sleeve, add up to 6, remove any) and rows keyed by size. "Use sizes from variants" prefills the row list from that product's own variant sizes so they can't drift apart. A product's PDP "Size guide →" link carries its slug (`/size-guide?product=<slug>`); the size guide page looks up that product and renders its table, falling back to a generic reference chart when a product has no measurements entered yet. The page is still reachable directly at `/size-guide` (it'll show the generic chart), but the static link to it was removed from the footer.

## Category branches (Men / Women / Unisex)

Categories are fully admin-managed from `/admin/categories` — no more hard-coded list. Every category belongs to one main branch: pick Men, Women, or Unisex (mandatory) before naming a subcategory ("Jeans", "Hoodies", whatever the store sells). Trying to add a name that already exists under that branch shows an inline error instead of creating a duplicate. A category created under **Unisex** is automatically mirrored into Men and Women under the same name, so it's browsable from either gender's header dropdown and selectable on a Men's or Women's product too — the products themselves never duplicate or move.

The storefront header's Men/Women dropdowns, `/men/[category]` and `/women/[category]` pages, and the admin product editor's category picker all read live from this same table, so a category added in the admin panel shows up everywhere immediately — no code change or redeploy. The product editor's **Organize** panel is a two-step picker: main branch first, then that branch's subcategories (mandatory, single-select) — there's no separate Gender field any more, since a product's gender is simply its chosen category's branch. The selected subcategory's name shows as a small tag on every product card. A product saved under a Unisex subcategory shows up when browsing either `/men` or `/women` (matched by branch + Unisex at query time), not just under Unisex.

The old flat `Category`-shared-by-both-genders model and the separate `Collection`/"drops" feature have both been removed — categories are now the only taxonomy, and they're the one driving navigation, filtering, and sorting across the whole site.

Each category also carries an optional **image** (`Category.imageUrl`, set from the same `/admin/categories` page — "Add image"/"Change image" next to its name). That's the tile photo everywhere a category shows up as a tile: the homepage's "Shop by category" spotlight and the `/men`/`/women` gender-hub category grid. No image set — the hand-drawn shape placeholder shows instead, same as before this existed.

## Hero images

Two editorial banners are admin-uploadable from `/admin/content`, no code deploy needed:

- **Homepage hero** (already existed) — the big top-of-page carousel, eyebrow/headline/sub copy, background color, and up to 8 rotating photos.
- **Gender hub heroes** (Men hero image / Women hero image) — the banner at the top of `/men` and `/women`, behind the "Shop Men/Women" button. Each is just one photo (the page's own title/eyebrow text already sits above it) — stored as `ContentBlock` rows keyed `men_hero`/`women_hero`, same pattern as the homepage hero's `home_hero` block. Unset — the drawn "EDITORIAL HERO" placeholder shows instead.

## Auto-generated slug and SKU

Neither field is manually typed by the admin, though both are kept — slug is the product's actual `/product/<slug>` URL (can't be dropped without breaking every product link), SKU is what Inventory search and Finance's variant picker key off of (dropping it would lose that, so it's generated instead). The **Slug** field under Status & SEO auto-fills from the title as it's typed, until the admin edits the slug directly — from then on (and always, when editing an already-saved product) it stops auto-syncing, so renaming a product later never silently changes a URL that might already be shared or indexed.

**SKU** isn't an input at all — the variant table shows it as plain text. For a brand-new (unsaved) variant row, a title/size/color-derived candidate (e.g. `CRIMSO-M-BLA-N1LD`) appears the instant the row exists, built from a per-row random-looking token that's assigned once and then stays fixed while the preview's human-readable parts keep tracking the title/size/color as they're edited. That token comes from `useId()` (React's SSR/hydration-stable id primitive) rather than `Math.random()`, since the form's first render happens once on the server and once again during client hydration — a value that differed between those two passes would trip a hydration mismatch.

Both slug and SKU are re-verified for uniqueness server-side on every save (`ensureUniqueSlug`/`ensureUniqueSku` in `src/actions/admin-products.ts`), not just trusted from the client: each checks the candidate against the database inside the save transaction and, only if it's genuinely taken by some other product/variant, appends a short random suffix (retrying until a free one is found) — so two products titled the same thing, or two variants that happen to land on the same seed, both still get a unique, title-resembling slug/SKU instead of the save failing outright. A further transaction-level retry (`runWithUniqueRetry`) covers the narrow race where two saves land on the same instant and both pass their checks before either commits — the retry's checks then see the first save's already-committed row and simply pick a different value, invisibly to the admin.

## Fixed size scale

Sizes aren't admin-typed either. Every apparel product gets the same 6 sizes — S, M, L, XL, XXL, XXXL (`src/lib/sizes.ts`) — the instant a color is added; there's no adding, removing, or renaming an individual size row any more, only editing each size's own stock/price/preorder. Non-apparel products (bags, beanies, snapbacks, sock sets) use a single "One Size" variant instead — the admin picks **Apparel** or **One Size** once, before the product's first color exists, and every color added after that gets the matching full set. The PDP always shows all 6 sizes (or the one "One Size" button) in that same left-to-right order, with anything actually out of stock shown crossed out exactly as before — nothing about *that* changed, only where the size list itself comes from.

A product saved before this scheme existed (or before XXXL did) can have a color missing a size — opening it in the editor fills the gap in as a fresh, zero-stock row automatically, and the product is permanently complete again the next time it's saved.

## Admin product editor reliability fixes

Two bugs made the product editor feel unreliable, on top of the slug/SKU work above:

- **Tags (and everything else) resetting when switching products.** The editor is a big client component whose fields are only ever initialized once, from its `initial` prop — but clicking from one product's edit page to another's is a same-route navigation (`/admin/products/[id]` → `/admin/products/[id]`), which React doesn't treat as a reason to re-mount the component, so none of those `useState` initializers re-ran for the new product. Every field — title, tags, variants, images, all of it — kept showing whichever product the form happened to mount with first. Fixed with `key={product.id}` (and `key="new"` on the create page) on `<ProductEditorForm>`, which tells React these are different logical instances and forces a real remount per product.
- **Saving an existing product could fail with "That ... is already in use" for no apparent reason.** Two existing variants trading sizes (or two colors trading names) is a perfectly valid end state with no duplicate anywhere — but Postgres checks `@@unique([productId, size, color])` immediately after each row is written, not deferred to commit, so writing one row's new value while another still held it collided mid-save even though the transaction would have balanced out. `saveProduct()` now parks every existing variant on a temporary, guaranteed-unique placeholder first, then writes every real value once nothing is contested — closing the one gap the slug/SKU uniqueness checks above couldn't, since those only ever validate against the database's state *before* a save begins.

## Chat bubble

A floating chat button (bottom-right, every storefront page) offers direct WhatsApp and/or Messenger links to the store's contact accounts. Off by default — turn it on and fill in a WhatsApp number and/or a Facebook Messenger page username/ID at `/admin/settings` → Chat. Only the option(s) with a value filled in are shown, so either channel works alone. The WhatsApp link opens `wa.me` with your configured number and an optional prefilled message; the Messenger link opens `m.me/<page>` — both in a new tab, no page credentials or SDKs involved.

## Two-factor authentication (admin/staff)

`/admin/settings` → **Security** lets any admin or staff account turn on TOTP-based 2FA (compatible with Google Authenticator, Authy, 1Password, etc.) for their own login — scan the QR code (generated locally via the `qrcode` package; the secret is never sent to any third party) or enter the manual key, confirm with a 6-digit code, and save the one-time backup codes shown afterward. Once enabled, email/password login requires a second step: a live 6-digit code or an unused backup code (each usable once). Failed code attempts count against the same 5-attempt/15-minute lockout as password login. 2FA applies only to the email/password login path — Google/Facebook admin sign-in is unaffected, consistent with OAuth admin login never being a privilege-escalation route. The TOTP implementation (`src/lib/totp.ts`) is a from-scratch RFC 6238 implementation with no third-party dependency for the cryptographic core.

## Inventory finance

`/admin/finance` tracks who actually paid for stock and what it cost, separately from the day-to-day stock-quantity edits on `/admin/inventory`:

- **Stock owners** — the people/entities who fund inventory purchases.
- **Stock purchases** — recording one (owner, product variant, quantity, unit cost, supplier, date) both logs the purchase and increments that variant's stock in the same transaction, so it's the accountable way stock goes up.
- **Financial summary** — capital invested (all-time, by owner), revenue from paid orders, cost of goods sold (weighted-average unit cost per variant from purchase history × units sold), gross profit/margin, each owner's proportional share of capital and profit, and current inventory value at cost. Sold or in-stock units with no recorded purchase history are called out explicitly rather than silently treated as zero-cost.

## Motion & lighting

The storefront carries a small ambient/interactive motion layer, all opt-out via `prefers-reduced-motion` (CSS-driven effects are neutralized automatically by the global reduced-motion rule in `globals.css`; JS-driven ones check `window.matchMedia` themselves):

- **Background wall** — a fixed scatter of the site's own circle/square/X marks (`.site-wall` in `globals.css`, same fixed-div pattern as the film grain, mounted once in the storefront layout, negative `z-index` so it always stays behind content). Tuned to read clearly as a deliberate wallpaper without competing with foreground content.
- **Crayon scribble accents** — `CrayonScribble.tsx`, a fan of textured crayon strokes (SVG `feTurbulence`/`feDisplacementMap` for the hand-drawn roughness) scattered across open space on the homepage hero, the three homepage section headers, the gender-hub PLP header, and the footer — each a distinct brand color, each `id` unique per page for its SVG filter.
- **Film grain** — a fixed, near-invisible animated grain overlay (`.site-grain` in `globals.css`, mounted once in the storefront layout).
- **Marquee ticker** — an endless-scroll brand strip (`MarqueeTicker.tsx`) between the header and page content.
- **Magnetic buttons** — `Button.tsx` pulls slightly toward the cursor on hover (pointer-move only, skipped on touch) with a lime glow; falls back to the existing CSS hover styles with the pointer away or reduced motion on.
- **Outlined label** — every non-text `Button` (primary and ghost) traces a dark outline directly around its label's glyphs (`-webkit-text-stroke` plus a `text-shadow` fallback), so the text reads clearly against any fill without a background panel behind it. Applies uniformly to every real CTA (Shop now, Add to cart, Preorder, Checkout, etc.) since it lives in the shared component; skipped on the `text` variant, which behaves like an inline link.
- **Button hover scribble** — every non-text `Button` draws in a hand-scribbled underline, sized to match the button's own full width exactly (not just centered text), below it on hover/focus. Color is chosen by a deterministic hash of the button's own label (stable, not random-each-render) from the brand palette minus that variant's own dominant color, so it always reads as a distinct accent rather than blending in. Pure CSS `:hover`/`:focus-visible` stroke-dashoffset draw-on, same technique as the nav's scribble-link underline.
- **Scroll reveal + 3D tilt** — `ProductCard.tsx` fades/slides in as it enters the viewport (`IntersectionObserver`, defaults visible so it never breaks with JS off) and tilts toward the cursor on hover.
- **Glitch / RGB-split hover** — `.glitch-text` (`globals.css`) applied via `className` + `data-text` on the homepage hero badge and the sale tag pill; pure CSS, no client JS. It doesn't set its own `position` — each usage site supplies one (already-`absolute`, or add `relative`), since forcing it in the shared rule would fight an already-positioned caller.
- **Scribble draw-on underline** — `ScribbleLink.tsx`, used for the header nav and footer legal links; pure CSS `:hover`/`:focus-visible`, no client JS.
- **Text scramble reveal** — `ScrambleHeadline.tsx` decodes the homepage hero headline in on mount; renders the real text immediately (SSR-safe) and only scrambles as a flourish on top.
- **Ink-splat click burst** — `AddToCartForm.tsx` spawns a brief colored splat at the click point on Add to cart / Preorder.
- **Preorder banner pulse** — the preorder-eligible banner in `AddToCartForm.tsx` pulses once when it appears, keyed to the selected variant so it only replays on a genuinely new preorder-eligible selection.
- **PDP image zoom** — on desktop, clicking the main product image toggles a 2.2x zoom anchored to the click point; moving the mouse while zoomed pans the view by re-anchoring the zoom's origin to the cursor, click again to zoom back out. Mouse-only (`pointerType === "mouse"`), so it never competes with the same element's touch-swipe slide navigation on mobile.
- **Loading skeletons** — every storefront and admin page falls back to a themed shimmering skeleton (`Skeleton.tsx` + `loading.tsx` per route group) while its own data is still fetching, via Next.js's built-in `loading.tsx` convention — no per-page wiring needed.

The `Button` scribble treatment covers the shared `Button.tsx` component, which is what every real storefront CTA (Shop now, Add to cart, Preorder, Notify me, Checkout, etc.) is built from. Smaller account/admin-area raw `<button>` elements (form saves, qty steppers, accordion toggles) intentionally don't carry it — the effect is sized and paced for a primary call-to-action, not a utility control.

## Notes for further work

- Abandoned-checkout reminders are admin-triggered (`/admin/campaigns` → "Send all pending reminders") rather than on an automatic schedule — wire that button's action (`sendAllAbandonedReminders` in `src/actions/admin-marketing.ts`) into a cron job for real automation.
- The free-delivery tag is presentational only; making it actually waive the shipping fee would mean threading it into `src/actions/checkout.ts`'s shipping-cost calculation.
- OAuth account linking is by email match — if someone's Google email differs from the email on their existing password account, they'll get a second, separate account rather than a merge prompt.
