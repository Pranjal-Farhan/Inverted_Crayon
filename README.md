# Inverted Crayon

Streetwear storefront + admin, built from the [Build Specification v1.0](.) — Next.js 16 (App Router), TypeScript, Tailwind v4, Prisma 7 / PostgreSQL.

**This is the quickstart.** For the full architecture — every model, every route, every server action, how they connect, and the design philosophy behind all of it — see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack, Server Actions)
- **Database**: PostgreSQL via Prisma 7 (`@prisma/adapter-pg` driver adapter)
- **Styling**: Tailwind CSS v4, design tokens in `src/app/globals.css` matching Build Spec §02–§04
- **Auth**: Signed JWT session cookies (`jose`) — separate admin and customer sessions. Email/password always works; Google and Facebook sign-in work too once you add OAuth credentials (see below) — until then the buttons bounce back with a clear message instead of erroring. Admin/staff accounts can additionally turn on TOTP two-factor authentication (Google Authenticator-compatible) from `/admin/settings` → Security.
- **Payments**: bKash and SSLCommerz (cards/mobile banking) go live the moment you add real merchant credentials (see below); without them, checkout falls back to instantly marking the order paid so local dev needs no external accounts. COD is always available for non-preorder orders. Preorders require a 20–100% online advance via bKash/card, with the rest collected as COD at delivery.
- **Emails**: Every "send" always writes to an `EmailLog` outbox (viewable at `/admin/emails`); add a Resend API key (see below) and it also actually sends. See `src/lib/mail.ts`.
- **Order-confirmation SMS**: same outbox pattern as email — every confirmed order writes to an `SmsLog` outbox (viewable at `/admin/sms`); add SSL Wireless credentials (see below) and it also actually sends. See `src/lib/sms.ts`.

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
| Payment-gateway callback URLs | `SITE_URL` (e.g. `https://yourstore.com`) | Recommended in production so callback URLs are stable and correct behind any proxy; without it the app derives the origin from request headers |

Google/Facebook sign-in for **admin and staff accounts** only ever logs in to an account that already exists (matched by email) — it never self-registers a new admin, so there's no privilege-escalation path from someone else's OAuth login. Customer sign-in, by contrast, creates a new customer account on first login, same as registering with a password.

## Deploying to a real server

- **`SESSION_SECRET` is required in production** — the app refuses to start without it (`src/lib/session.ts`) rather than silently signing session cookies with a well-known fallback. Generate one with `openssl rand -base64 48`.
- **`DATABASE_URL`** must point at your production Postgres (managed providers' `?sslmode=require` connection strings work as-is). The app also refuses to start without it.
- **Don't run `npx prisma db seed` against production** — it's a demo dataset with known test-account passwords (see the table above) and refuses to run when `NODE_ENV=production` unless you explicitly set `ALLOW_PRODUCTION_SEED=true` (and, for the admin account specifically, `ADMIN_EMAIL`/`ADMIN_PASSWORD` of your choosing). Run `npx prisma migrate deploy` to apply the schema instead, then create your real admin user by hand.
- **Admin/customer login lock out after 5 failed attempts** for 15 minutes per account (`src/lib/login-lockout.ts`) — there's no rate limiting in front of the app otherwise (no WAF/CDN assumed), so this is the only brute-force guard.
- **Security headers** (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, a permissive-by-default `Permissions-Policy`, and HSTS when served over HTTPS) are set for every response in `src/proxy.ts`. No CSP is set — add one if you need it, testing carefully since a wrong CSP silently breaks pages rather than erroring.
- **Checkout is safe under concurrent load**: stock decrements and discount-code redemptions use guarded atomic updates inside the order transaction (not read-then-write), so two simultaneous checkouts for the last unit of stock (or the last use of a limited coupon) can't both succeed — one gets a clear "not enough stock" / "code fully redeemed" error instead of silently overselling.
- **Product photo uploads are local disk** (`public/uploads/products/<id>/`, up to 20 images per product), fine for a persistent VPS/container with a stable filesystem, but they will not survive a serverless or ephemeral-disk deploy (e.g. plain Vercel) or work correctly if you run multiple app instances behind a load balancer without a shared volume — swap in S3/Cloudinary-backed storage first if that's your target. The homepage's logo/hero-carousel uploads (`/admin/content`) work the same way, under `public/uploads/site/`.

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

The advance is **per unit**, admin-set, not something the customer picks at checkout — `0` means free to reserve, everything due on delivery; anything above that is charged online (bKash/card) at checkout, with the rest collected as cash on delivery. COD as the *sole* payment method is only available when every preorder item in the cart has a `0` advance; otherwise the advance portion has to be paid online, same "COD can't fund a partial capture" reasoning as before. Admins see and mark the outstanding balance collected from the order-detail page's **Mark COD balance collected** button, and the exact advance-paid/balance-due split shows up on the customer's order confirmation, the SMS, the confirmation email, and the printable receipt.

## Order-confirmation SMS

Every confirmed order texts the customer's contact number (the "Phone (delivery SMS)" field from checkout) with order details, amount, and delivery location — content differs by how the order is paid:

- **Full paid** (bKash/card, nothing outstanding): order number, item(s), total paid, shipping location.
- **Cash on delivery**: order number, item(s), total due at delivery, delivery location.
- **Preorder partial payment**: order number, item(s), advance amount paid online, balance due as COD, delivery location.

Fires at every point an order actually becomes confirmed: the instant-paid/COD path in `placeOrder`, and both the bKash and SSLCommerz payment-success callbacks. Like email, it's mocked by default (every "send" lands in the `SmsLog` outbox at `/admin/sms`) and switches to real delivery once SSL Wireless credentials are set (see above).

## Free delivery tags

Each product's admin editor (Organize panel) has a **Free delivery** field — None / Inside Dhaka / Nationwide — that renders as a tag on that product's PDP next to Add to cart. Purely informational (it doesn't currently zero out the shipping line at checkout, which is calculated per-order from the shipping zone).

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

- **Film grain** — a fixed, near-invisible animated grain overlay (`.site-grain` in `globals.css`, mounted once in the storefront layout).
- **Marquee ticker** — an endless-scroll brand strip (`MarqueeTicker.tsx`) between the header and page content.
- **Magnetic buttons** — `Button.tsx` pulls slightly toward the cursor on hover (pointer-move only, skipped on touch) with a lime glow; falls back to the existing CSS hover styles with the pointer away or reduced motion on.
- **Scroll reveal + 3D tilt** — `ProductCard.tsx` fades/slides in as it enters the viewport (`IntersectionObserver`, defaults visible so it never breaks with JS off) and tilts toward the cursor on hover.
- **Glitch / RGB-split hover** — `.glitch-text` (`globals.css`) applied via `className` + `data-text` on the homepage hero badge and the sale tag pill; pure CSS, no client JS. It doesn't set its own `position` — each usage site supplies one (already-`absolute`, or add `relative`), since forcing it in the shared rule would fight an already-positioned caller.
- **Scribble draw-on underline** — `ScribbleLink.tsx`, used for the header nav and footer legal links; pure CSS `:hover`/`:focus-visible`, no client JS.
- **Text scramble reveal** — `ScrambleHeadline.tsx` decodes the homepage hero headline in on mount; renders the real text immediately (SSR-safe) and only scrambles as a flourish on top.
- **Ink-splat click burst** — `AddToCartForm.tsx` spawns a brief colored splat at the click point on Add to cart / Preorder.
- **Preorder banner pulse** — the preorder-eligible banner in `AddToCartForm.tsx` pulses once when it appears, keyed to the selected variant so it only replays on a genuinely new preorder-eligible selection.

## Notes for further work

- Abandoned-checkout reminders are admin-triggered (`/admin/campaigns` → "Send all pending reminders") rather than on an automatic schedule — wire that button's action (`sendAllAbandonedReminders` in `src/actions/admin-marketing.ts`) into a cron job for real automation.
- The free-delivery tag is presentational only; making it actually waive the shipping fee would mean threading it into `src/actions/checkout.ts`'s shipping-cost calculation.
- OAuth account linking is by email match — if someone's Google email differs from the email on their existing password account, they'll get a second, separate account rather than a merge prompt.
