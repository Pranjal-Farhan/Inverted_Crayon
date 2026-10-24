# Inverted Crayon

Streetwear storefront + admin, built from the [Build Specification v1.0](.) — Next.js 16 (App Router), TypeScript, Tailwind v4, Prisma 7 / PostgreSQL.

**This is the quickstart.** For the full architecture — every model, every route, every server action, how they connect, and the design philosophy behind all of it — see **[ARCHITECTURE.md](./ARCHITECTURE.md)**.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack, Server Actions)
- **Database**: PostgreSQL via Prisma 7 (`@prisma/adapter-pg` driver adapter)
- **Styling**: Tailwind CSS v4, design tokens in `src/app/globals.css` matching Build Spec §02–§04
- **Auth**: Signed JWT session cookies (`jose`) — separate admin and customer sessions. Email/password always works; Google sign-in works too once you add OAuth credentials (see "Google sign-in setup") — until then the buttons bounce back with a clear message instead of erroring. Admin/staff accounts can additionally turn on TOTP two-factor authentication (Google Authenticator-compatible) from `/admin/settings` → Security.
- **Payments**: **cash on delivery is the only payment method**, in every shipping zone and for every order including preorders (nothing is captured online for a preorder either — see "Preorders" below). There are no payment settings. The bKash/SSLCommerz integration code is still in the repo (`src/lib/payments/*`) but unreachable — checkout never offers it and `placeOrder()` rejects it.
- **Emails**: Every "send" always writes to an outbox first (`EmailLog` at `/admin/emails`); connect your official mailbox (SMTP) or Resend (see "Email setup") and it also actually sends. What each message says is editable at `/admin/templates`. See "Emails" below and `src/lib/notifications.ts`. (Text-message/SMS sending has been switched off — see "SMS is switched off".)
- **Image hosting**: Product photos, the CMS logo, and hero images upload to ImgBB when `IMGBB_API_KEY` is set. The database stores the returned CDN URL instead of Base64 or local files.

## Getting started

```bash
npm install

# copy and fill in .env — needs a running Postgres instance
cp .env.example .env

npx prisma migrate dev   # creates tables
npx prisma db seed       # seeds catalog, orders, admin/customer test accounts

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
| bKash payments | `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, optional `BKASH_BASE_URL` | bKash merchant/PGW onboarding. Defaults to bKash's sandbox host |
| Card / mobile banking | `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, optional `SSLCOMMERZ_SANDBOX=false` for production | SSLCommerz merchant account. Sandbox credentials work against the sandbox host by default |
| Real email delivery (your own mailbox) | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_PORT` (default 465), `SMTP_SECURE`, `EMAIL_FROM` | Your mailbox's SMTP details — for Gmail, `smtp.gmail.com` and an app password. See "Email setup" below |
| Real email delivery (Resend) | `RESEND_API_KEY`, `EMAIL_FROM` | resend.com — needs a verified sending **domain**; can't send from a `@gmail.com` address. Ignored if SMTP is set |
| Image hosting | `IMGBB_API_KEY` | imgbb.com — create an API key in your account settings |
| Payment-gateway callback URLs | `SITE_URL` (e.g. `https://yourstore.com`) | Recommended in production so callback URLs are stable and correct behind any proxy; without it the app derives the origin from request headers |

Google sign-in for **admin and staff accounts** only ever logs in to an account that already exists (matched by email) — it never self-registers a new admin, so there's no privilege-escalation path from someone else's OAuth login. Customer sign-in, by contrast, creates a new customer account on first login, same as registering with a password.

## Deploying to a real server

- **`SESSION_SECRET` is required in production** — the app refuses to start without it (`src/lib/session.ts`) rather than silently signing session cookies with a well-known fallback. Generate one with `openssl rand -base64 48`.
- **`DATABASE_URL`** must point at your production Postgres (managed providers' `?sslmode=require` connection strings work as-is). The app also refuses to start without it.
- **Don't run `npx prisma db seed` against production** — it's a demo dataset with known test-account passwords (see the table above) and refuses to run when `NODE_ENV=production` unless you explicitly set `ALLOW_PRODUCTION_SEED=true` (and, for the admin account specifically, `ADMIN_EMAIL`/`ADMIN_PASSWORD` of your choosing). Run `npx prisma migrate deploy` to apply the schema instead, then create your real admin user by hand.
- **Admin/customer login lock out after 5 failed attempts** for 15 minutes per account (`src/lib/login-lockout.ts`) — there's no rate limiting in front of the app otherwise (no WAF/CDN assumed), so this is the only brute-force guard.
- **Security headers** (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, a permissive-by-default `Permissions-Policy`, and HSTS when served over HTTPS) are set for every response in `src/proxy.ts`. No CSP is set — add one if you need it, testing carefully since a wrong CSP silently breaks pages rather than erroring.
- **Checkout is safe under concurrent load**: stock decrements and coupon redemptions use guarded atomic updates inside the order transaction (not read-then-write), so two simultaneous checkouts for the last unit of stock (or the last use of a limited coupon) can't both succeed — one gets a clear "not enough stock" / "code fully redeemed" error instead of silently overselling.
- **Product photo uploads use ImgBB** when `IMGBB_API_KEY` is configured (up to 20 images per product). The homepage logo and hero-carousel uploads under `/admin/content` use the same ImgBB integration. Existing Base64 or legacy local-file URLs remain readable, but new uploads are stored as CDN URLs.

## Quiet spells: a sleeping database

Managed Postgres hosts (Neon, Supabase and similar free tiers) suspend a database that has been idle, and the first visitor afterwards used to meet a hung or failed page while it woke up. Three things now deal with that:

1. **The database connection limits and retries itself** (`src/lib/db-resilience.ts`). Each connection attempt is cut off after **7 seconds** (including the database's start-up handshake, so a database that accepts the connection but never answers can't hang a page) and is retried up to **3 times** with short pauses. Only "couldn't get a connection / the database isn't up yet" failures are retried — those happen before any SQL is sent, so a query is never run twice; wrong passwords and errors inside a query show up immediately. A database that wakes in under ~20 seconds is absorbed silently; a visitor just waits a moment. Tune with `DB_CONNECT_TIMEOUT_MS` (500–60000) and `DB_CONNECT_ATTEMPTS` (1–6) if your host needs it; the defaults suit most. Each retry is logged as `[db] connection attempt n/3 failed …`, so the Vercel logs show when this is happening.
2. **A friendly retry page** replaces the bare "server error". If a page still can't be built, the visitor sees **"Warming up…"** in the shop's style (the site header stays on storefront pages), a countdown, and the page **retries by itself** after 3, 5, 8, 12 and 20 seconds and recovers without a click once the database is back. After those tries it says "Still waking up" and offers a **Try again** button. The admin panel gets the same behaviour with admin wording, and stays signed in.
3. **A periodic ping keeps the database awake.** `/api/health` runs a trivial query and answers `{"ok":true}` (or `503` when the database can't be reached). It is called:
   - **every 5 minutes, 07:00–23:55 Bangladesh time** by the GitHub Action `.github/workflows/keep-database-awake.yml` (free: the repository is public). It pings the repository variable `SITE_URL` if you set one (Settings → Secrets and variables → Actions → Variables — do this if you add a custom domain), otherwise `https://invertedcrayon.vercel.app`. It never fails the run, so an outage doesn't send an e-mail every five minutes; look for a yellow warning in the Actions tab instead. Run it by hand from the Actions tab (**Run workflow**) to test.
   - **once a day** by Vercel Cron (`vercel.json`) as a safety net — Vercel's free plan only allows daily crons, and GitHub switches scheduled workflows off after 60 days without repository activity.

   The ping window is deliberately daytime-only: providers that bill by compute time (Neon's free allowance) would otherwise be kept running all night. For round-the-clock pings change the cron in the workflow to `*/5 * * * *`. Any uptime monitor (UptimeRobot, Better Stack…) pointed at `/api/health` works as well or instead.

## Project structure

```
prisma/schema.prisma          data model (§10 of the spec, extended)
prisma/seed.ts                catalog + orders + accounts seed
src/app/(storefront)/         public site — home, PLP/PDP, cart, checkout, account, legal
src/app/admin/                admin app — dashboard, orders, products, CRM, emails, settings
src/actions/                  server actions (checkout, admin CRUD, auth, mail-triggering events)
src/components/                brand, ui, layout, storefront, admin component libraries
src/lib/                      domain logic — tag/pricing derivation, cart, sessions, settings, mail
```

## Build phases

Both P1 (launch-critical) and P2 (fast-follow) from the spec's §13 checklist are implemented in full, including every item originally listed but not elaborated on in the page-by-page spec (lifecycle emails, staff roles management):

- **P1**: design system, storefront browse/PDP, cart → guest checkout → confirmation → track order, admin dashboard/orders/products/categories/settings (including the message Templates page), all legal/utility pages.
- **P2**: customer accounts (register/login/orders/returns/wishlist/back-in-stock — guest orders auto-claim on registration), drops/collections landing, lookbook, live search suggestions, a "recently viewed" rail, a swipeable multi-image PDP gallery, admin CRM/discounts/content CMS/analytics/staff-roles CRUD, and the full lifecycle email set (order confirmed/shipped, back-in-stock, newsletter welcome, contact acknowledgement, plus notification emails to the brand).

## Homepage CMS

`/admin/content` → **Brand identity**, **Marquee ticker**, and **Homepage hero** panels control, without a code deploy: the logo image (falls back to the drawn monogram + wordmark when unset), brand name, motto (shown in the footer), the scrolling strip's 3–5 headlines (any length), the hero eyebrow/headline/sub-copy/badge text, a hero background color override, and a hero image carousel (falls back to a styled placeholder when empty). All of it renders live site-wide (the marquee shows on every page, not just `/`) immediately after publishing.

`/admin/footer` → controls the footer's social icons (Facebook, Instagram, WhatsApp only — leave a URL blank to hide that icon) and the text content of the **FAQ**, **Contact**, **Privacy**, and **Terms** pages (headings, intro copy, and — for FAQ/Privacy/Terms — the full question/section list), each published independently. There is no separate Shipping & Returns page any more; its returns policy now lives inside Terms.

## Homepage "New In" — 20 at a time, load more

The homepage's "New In" grid loads 20 products on first render and a **Load more** button fetches 20 more from `/api/products/new` each time it's pressed, repeating until every active product has been shown (the button then disappears).

## Preorders — "Preorder Now and Our Sales Agent Will Reach Out"

Any size/color becomes a preorder **the moment it sells out**, if you've turned preorder on for it in that product's editor (the **Preorder ৳** field, per row in the variant table) — blank means it just stays "sold out", any value set (including `0`) means it keeps selling. This covers two cases with one mechanism: a genuinely pre-launch product (every size starts at 0 stock, tag it **Preorder** in the Tags panel too, which adds a Preorder banner to its page) and an ordinary product where one size just ran out (no tag needed — it flashes a "Preorder it and our sales agent will reach out" banner and stays purchasable automatically).

No advance payment is ever shown to or charged against the customer — the **Preorder ৳** field is purely an on/off switch (kept under that name so a future bKash/SSLCommerz reactivation has a per-unit amount ready to use again). Every customer-facing surface — the PDP, cart, checkout, order confirmation, email, and the receipt — shows one fixed line instead: **"Preorder Now and Our Sales Agent Will Reach Out."** At checkout, a cart with a preorder item shows a blinking golden "Preorder" tag beside the "CHECKOUT" heading, a **"Preorder Process"** step with that fixed line, and the submit button reads **PreOrder** instead of Place order.

> **bKash / card checkout is currently commented out.** `CheckoutView.tsx` only ever offers **Cash on delivery**, and `placeOrder()` rejects a direct `BKASH`/`SSLCOMMERZ` submission server-side too — both reversibly, pending re-enabling. COD works for every cart, preorders included.

## Delivery charges — set per product

Delivery cost is set on each product, in its editor: **Delivery charge ৳ (Inside/Outside Dhaka)** — the real cost to ship an item genuinely varies product to product. A box left blank uses the standard rate (৳60 inside Dhaka, ৳120 outside; shown as the placeholder in the box). There is no shipping tab in Settings. When a cart mixes several products with their own charges, the highest applies (they ship together as one shipment); `resolveShippingCost()` (`src/lib/shipping.ts`) is the one place both the checkout page and the server's actual charge compute this from, so the number shown always matches what's billed.

## Email setup (sending from your official mailbox)

The site sends from, and your team's notifications go to, your official mailbox. Two things are involved, and they are separate:

1. **Where notifications and replies go** — the **email** in `/admin/settings` → Store. Set it to the official address.
2. **Which account sends the mail** — connected with environment variables on the server (never stored in the database).

**Using a Gmail / Google Workspace address (recommended to start):**

1. On the official Google account, turn on **2-Step Verification** (Google Account → Security).
2. Create an **app password**: Google Account → Security → 2-Step Verification → **App passwords** (or open myaccount.google.com/apppasswords). Name it "Inverted Crayon site" and copy the 16-character password. Use this — **not** the account's normal password.
3. In your hosting (Vercel → Project → Settings → Environment Variables) add:
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_PORT` = `465`
   - `SMTP_USER` = the official Gmail address
   - `SMTP_PASS` = the app password
   - optionally `EMAIL_FROM` = `Inverted Crayon <the official address>` (without it, the mail goes out as the store's name from `SMTP_USER`)
4. **Redeploy** (environment changes only apply to a new deployment).
5. Open `/admin/emails`: the **Email delivery** panel should say **LIVE** with the sender. Use **Send test email** to send one to yourself — if something is wrong (a wrong password, an unreachable host) it says exactly what.

From then on every email shows **SENT** or **FAILED** (with the mail server's reason) in the outbox, and customers' replies to order emails land in the official mailbox. An order is never held up or lost because mail failed — the failure is just recorded. Gmail allows roughly 500 recipients a day (about 2,000 on Workspace), plenty for a small store; the messages also appear in the mailbox's **Sent** folder.

**PDF receipts on order emails.** Every order-related email — to the customer (order confirmed, order shipped, cancellation request received, order cancelled) and to the official address (new order, new pre-order, shipping/refund updates, delivered, cancellation request, return request) — carries the order's receipt as an attached PDF named `Receipt-<order number>.pdf`: the same layout as the printable receipt at `/admin/orders/<id>/receipt` (items, coupon / free-delivery line, shipping, total, ship-to). It is generated on the server at send time, so it always reflects the order's current status. Bangla names and addresses and the ৳ sign are supported (Noto Sans + Noto Sans Bengali are bundled in `src/assets/fonts/`). If a receipt ever can't be generated, the email is still sent without it. Attachments are listed under each message in `/admin/emails` (📎).

**Using a domain mailbox** (e.g. `hello@yourdomain.com` on cPanel, Zoho, Outlook…): the same variables, with that provider's SMTP host/port/username/password. **Resend** is an alternative if you'd rather use an API service, but it needs a verified domain and cannot send from a `@gmail.com` address.

## Google sign-in setup

"Continue with Google" appears on the customer login/register pages and the admin login page. It does nothing until the site has a Google OAuth client:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create (or pick) a project → **APIs & Services → OAuth consent screen**. Choose **External**, fill in the app name (Inverted Crayon), your support email and developer email, and save. The default scopes (`openid`, `email`, `profile`) are all it uses. While the app is in **Testing** only the Google accounts you list as test users can sign in — click **Publish app** when you're ready for everyone (this basic sign-in needs no Google review).
2. **APIs & Services → Credentials → Create credentials → OAuth client ID** → application type **Web application**. Under **Authorized redirect URIs** add exactly `https://<your-domain>/api/auth/google/callback` (and `http://localhost:3000/api/auth/google/callback` if you test locally). If the site is reachable on more than one domain (e.g. a `.vercel.app` address as well as your own), add each one.
3. Copy the **Client ID** and **Client secret** into the server's environment as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (Vercel → Project → Settings → Environment Variables), set `SITE_URL` to your public address (e.g. `https://yourdomain.com`, no trailing slash), then redeploy.
4. Try "Continue with Google" on `/account/login`. A new customer account is created on first sign-in; a customer who already registered with the same email is linked to it (Google must have verified that email).

**Admin and staff** can also sign in with Google, but only into an account that already exists with the same email (add it under Settings → Roles first) — it never creates an admin. If that account has two-factor authentication on, the authenticator code is still asked for afterwards.

## SMS is switched off

Text-message sending has been taken out of the app for now: no texts are sent or recorded, the `/admin/sms` page and the SMS tab in Templates are gone, and there are no SMS settings. The old `SmsLog` table and its rows are left untouched in the database, and the code is in git history (commit `ce02f89`) if SMS is wanted again.

## Customers (admin)

`/admin/customers` lists everyone who has ordered — **registered customers and guest buyers** (people who checked out without an account) — with their full personal details (name, email, every phone number, addresses, sign-in methods, notes) and their orders split into **current** (still in progress) and **past** (delivered, cancelled, refunded, returned), each with the items. Use the **Everyone / Registered customers / Guest buyers** tabs and the search box (name, email, phone, address, order number, product, amount or date). "Open full profile" gives the complete page for a person. A registered customer's orders placed while logged out (same email) are included and tagged "guest checkout".

## Order tracking — admin, account, and public

Every order gets a unique number at checkout (`generateOrderNumber()`, retried on the rare collision) and is visible from three places:

- **Admin** (`/admin/orders`) — every order, chronologically, regardless of who placed it. Each one's **Customer** panel shows "HAS ACCOUNT" with a link to that customer's CRM record, or "GUEST ORDER — NO ACCOUNT" with just what they typed at checkout. Fulfillment is a simple two-state toggle: **Not Cleared Yet** (received, not packed) → **Mark Sent For Delivery** (prompts for courier + tracking ref) → **Sent For Delivery**. These are presentation labels over the existing `OrderStatus` enum (`src/lib/order-status.ts`), not a new state machine — PAID/DELIVERED/CANCELLED/REFUNDED/RETURNED all still work as before.
- **Customer account** (`/account/orders`) — every order the logged-in customer has placed, with date/total/status. Clicking one opens its own page: every item (size, color, qty, line total), each title linking to that product's page, and a plain-English status line — "Your Order Is Being Processed." or "Your Order Has Been Dispatched." — above the existing step-by-step progress graphic.
- **Homepage "Track your order"** (`/order-status`) — paste an order number, no login needed, and see that order's items/status/total. Deliberately shows **only** that order's contents: no email, phone, name, or address, since a bare number doesn't prove it's actually yours — just enough to answer "where's my stuff." Full details (exact delivery address, etc.) are only ever shown on the logged-in account view above, which checks session ownership first.

**Checking out while logged in prefills the form from your account** — email, phone, full name, and (if you've saved one) your default address, with the page reading "Returning customer · `<you>`" instead of "Guest checkout." Every field stays editable; this only changes what the form starts with, not how `placeOrder()` processes it (it already linked the order to your account either way).

## Emails

Every message the site sends is one entry in `src/lib/message-templates.ts`, sent through `src/lib/messages.ts`; *when* each goes out is defined in one file, `src/lib/notifications.ts`. Messages are mocked by default (every "send" lands in the `/admin/emails` outbox) and switch to real delivery once an email provider (SMTP or Resend) is set (see above).

**To customers — email:** order confirmed, order shipped, cancellation request received and order cancelled (all with the PDF receipt attached), back in stock, newsletter welcome, contact-form acknowledgement.
**To the brand — email** (always to the address in Settings → Store): contact messages, new orders and new pre-orders (with the full receipt, customer details and admin links), order updates (sent for delivery / refunded / COD balance collected), order delivered, cancellation requests, return requests, new account registrations, login lockouts (customer, admin and staff — once, when the lock trips), and "notify me" sign-ups. Every order-related brand email (everything about a specific order) also carries the PDF receipt.

**Templates (`/admin/templates`)** lists every message in two tabs (emails to customers, emails to the brand) as editable boxes: change the body text, drop in `{placeholders}` (order number, items, receipt, customer details…), see a live preview, switch a message off, or reset it to the default. Subjects and recipients are fixed.

**No pre-order ship date.** Pre-orders don't carry a date any more: the Preorder tag just adds a banner to the product page, and the product editor has no ship-date field. The old "ship date changed" email is gone too (it no longer appears under Templates; old copies still show in the Emails outbox, marked retired).

**Cancellation requests.** A customer can ask to cancel an order that hasn't shipped from its page in their account. They are emailed straight away to say the request was received, the brand is emailed once, and the admin order page shows a "Customer requested cancellation" banner with the reason. Nothing is cancelled automatically — an admin or staff member decides. **Cancel order** on the admin order page (for an order that hasn't been sent for delivery) cancels it, puts its stock back and emails the customer the cancellation confirmation; a **Refund** on such an order that the customer had asked to cancel does the same, including the customer email. Both emails carry the PDF receipt, and both wordings are editable in Templates.

## Free delivery tags

Each product's admin editor (Organize panel) has a **Free delivery** field — None / Inside Dhaka / Nationwide — that renders as a tag on that product's PDP next to Add to cart. Purely informational (it doesn't currently zero out the shipping line at checkout, which is calculated per-order from the shipping zone).

## Per-product size guide

Each product's admin editor has a **Size guide** panel (`Product.sizeGuide`, a JSON column — `src/lib/size-guide.ts`): a table of measurement columns you name yourself (defaults to Chest/Length/Sleeve, add up to 12, remove any) and rows keyed by size — add as many size rows as you need, no cap. "Use sizes from variants" prefills the row list from that product's own variant sizes so they can't drift apart. A product's PDP "Size guide →" link carries its slug (`/size-guide?product=<slug>`); the size guide page looks up that product and renders its table, falling back to a generic reference chart when a product has no measurements entered yet. The page is still reachable directly at `/size-guide` (it'll show the generic chart), but the static link to it was removed from the footer.

**Reusable size guide templates** — `/admin/size-guides` lets you build a named measurements table once (e.g. "Men's Tees", "Snapbacks — One Size") and save it (`SizeGuideTemplate` model). From any product's own Size guide panel, pick a saved template from the dropdown and hit **Import** to copy its columns/rows straight into that product — no retyping the same table for every product that shares a fit. Importing replaces whatever's currently in the product's table; it doesn't link back to the template afterward, so editing the product's copy (or the template later) never affects the other.

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

Neither field is manually typed by the admin, though both are kept — slug is the product's actual `/product/<slug>` URL (can't be dropped without breaking every product link), SKU is what the products list and Finance's variant picker key off of (dropping it would lose that, so it's generated instead). The **Slug** field under Status & SEO auto-fills from the title as it's typed, until the admin edits the slug directly — from then on (and always, when editing an already-saved product) it stops auto-syncing, so renaming a product later never silently changes a URL that might already be shared or indexed.

**SKU** isn't an input at all — the variant table shows it as plain text. For a brand-new (unsaved) variant row, a title/size/color-derived candidate (e.g. `CRIMSO-M-BLA-N1LD`) appears the instant the row exists, built from a per-row random-looking token that's assigned once and then stays fixed while the preview's human-readable parts keep tracking the title/size/color as they're edited. That token comes from `useId()` (React's SSR/hydration-stable id primitive) rather than `Math.random()`, since the form's first render happens once on the server and once again during client hydration — a value that differed between those two passes would trip a hydration mismatch.

Both slug and SKU are re-verified for uniqueness server-side on every save (`ensureUniqueSlug`/`ensureUniqueSku` in `src/actions/admin-products.ts`), not just trusted from the client: each checks the candidate against the database inside the save transaction and, only if it's genuinely taken by some other product/variant, appends a short random suffix (retrying until a free one is found) — so two products titled the same thing, or two variants that happen to land on the same seed, both still get a unique, title-resembling slug/SKU instead of the save failing outright. A further transaction-level retry (`runWithUniqueRetry`) covers the narrow race where two saves land on the same instant and both pass their checks before either commits — the retry's checks then see the first save's already-committed row and simply pick a different value, invisibly to the admin.

## Fixed size scale

Sizes aren't admin-typed either. Every apparel product gets the same 6 sizes — S, M, L, XL, XXL, XXXL (`src/lib/sizes.ts`) — the instant a color is added; there's no adding, removing, or renaming an individual size row any more, only editing each size's own stock/price/preorder. Non-apparel products (bags, beanies, snapbacks, sock sets) use a single "One Size" variant instead — the admin picks **Apparel** or **One Size** once, before the product's first color exists, and every color added after that gets the matching full set. The PDP always shows all 6 sizes (or the one "One Size" button) in that same left-to-right order, with anything actually out of stock shown crossed out exactly as before — nothing about *that* changed, only where the size list itself comes from.

A product saved before this scheme existed (or before XXXL did) can have a color missing a size — opening it in the editor fills the gap in as a fresh, zero-stock row automatically, and the product is permanently complete again the next time it's saved.

## Product descriptions — Mood, Build, How n when to wear

Every product page has three description sections instead of one block of text: **Mood** (the feel of the piece), **Build** (fabric, fit, construction, care) and **How n when to wear** (styling and occasions). On desktop the three sit side by side across the full width of the page, each in its own card; on mobile they stack one under another. Each heading is in its own brand colour (pink, cyan, lime) and wrapped in crayon marks from the brand sheet — `{ }`, `[ ]` and `## … !!`.

In the admin, the product editor has a **Description — three sections** panel with one box per section. Type plain text: leave a blank line between paragraphs, and start a line with `- ` to make a bullet (handy for Build). **Mood is always required. Build and How n when to wear are required to publish** — a Draft can be saved half-written, but switching a product to Active needs all three. A section left empty is simply not shown on the storefront.

Products that existed before this change keep their old description as their **Mood**; Build and How n when to wear start empty. Until you fill them in, those products show only the Mood card, and they can't be saved as Active again until all three are written. The product list marks each such product with a yellow "Needs Build + How n when to wear" note under its status, so you can see what's left to write. (`Product.description` is still kept in step with Mood.)

## Admin product editor reliability fixes

Three bugs made the product editor feel unreliable, on top of the slug/SKU work above:

- **Tags (and everything else) resetting when switching products.** The editor is a big client component whose fields are only ever initialized once, from its `initial` prop — but clicking from one product's edit page to another's is a same-route navigation (`/admin/products/[id]` → `/admin/products/[id]`), which React doesn't treat as a reason to re-mount the component, so none of those `useState` initializers re-ran for the new product. Every field — title, tags, variants, images, all of it — kept showing whichever product the form happened to mount with first. Fixed with `key={product.id}` (and `key="new"` on the create page) on `<ProductEditorForm>`, which tells React these are different logical instances and forces a real remount per product.
- **Saving an existing product could fail with "That ... is already in use" for no apparent reason.** Two existing variants trading sizes (or two colors trading names) is a perfectly valid end state with no duplicate anywhere — but Postgres checks `@@unique([productId, size, color])` immediately after each row is written, not deferred to commit, so writing one row's new value while another still held it collided mid-save even though the transaction would have balanced out. `saveProduct()` now parks every existing variant on a temporary, guaranteed-unique placeholder first, then writes every real value once nothing is contested — closing the one gap the slug/SKU uniqueness checks above couldn't, since those only ever validate against the database's state *before* a save begins.
- **Photo uploads stalling on the second photo.** Product photos no longer go through the page's normal "server action" channel (which the browser runs strictly one after another and which re-renders the page after each call — a second photo could wait behind the first one for ever). Each photo now goes to its own upload endpoint, one at a time, and the box shows real progress ("Sending image 2 of 5 — 63%", then "Saving image 2 of 5…"). A photo over ~3.5MB is shrunk in your browser first (JPEG, longest side 3000px — far more than the store ever shows) because the host refuses requests over about 4.5MB. Talking to the image host (ImgBB) is stricter too: every attempt starts on a fresh connection, an attempt gives up after 15 seconds, and it tries 3 times, so a stuck request fails in well under a minute with a message like "ImgBB didn't answer within 15s (tried 3 times…)" instead of spinning. A failure on one photo is named while the rest carry on, and on the new-product page you always land on the saved product, even if some photos failed. If a photo still fails, the message says why and the host's function logs have one `[imgbb] attempt …` line per try.

**Deleting a product** now opens a proper confirmation popup (the product's name, how many photos and size/colour rows go with it, "past orders keep their line items"). The Cancel button is focused by default, so a stray Enter can't delete anything; Escape or a click outside also cancels.

## Chat bubble

A floating chat button styled to match the site (lime square with a pink offset shadow and a hand-drawn bubble; its panel closes on Escape or an outside tap), bottom-right on every storefront page, offers direct WhatsApp and/or Messenger links to the store's contact accounts. Off by default — turn it on and fill in a WhatsApp number and/or a Facebook Messenger page username/ID at `/admin/settings` → Chat. Only the option(s) with a value filled in are shown, so either channel works alone. The WhatsApp link opens `wa.me` with your configured number and an optional prefilled message; the Messenger link opens `m.me/<page>` — both in a new tab, no page credentials or SDKs involved.

## Admin and staff roles

**Admin** can use everything. **Staff** can use only Orders, Products, **Inventory**, Customers, Discounts, Size guides and Categories (plus their own two-factor setup under Settings → "My security"; on a product page they don't see or change its **Purchase cost**, or any buying cost on the Inventory page — admin-only finance figures); the Dashboard, Finance, Analytics, Content CMS, Footer, Emails, Templates, store settings and team accounts are admin-only. This is enforced on the server — every admin action and page checks the account's role, read fresh from the database, so demoting or removing an account takes effect immediately. A staff login lands on Orders. Admins manage accounts at `/admin/settings` → Roles. The rules live in `src/lib/admin-areas.ts`.

**Changing your own password:** every admin and staff member can do it at `/admin/settings` → Security (staff: "My security") → **Change password**. It asks for the current password (a wrong one counts toward the same 5-attempt lockout as logging in), and on success signs the account out on every *other* device while keeping the current one signed in. Nobody can change another person's password from there; an admin who needs to reset someone else removes and re-invites that account under Roles.

## Two-factor authentication (admin/staff)

`/admin/settings` → **Security** lets any admin or staff account turn on TOTP-based 2FA (compatible with Google Authenticator, Authy, 1Password, etc.) for their own login — scan the QR code (generated locally via the `qrcode` package; the secret is never sent to any third party) or enter the manual key, confirm with a 6-digit code, and save the one-time backup codes shown afterward. Everything is tied to the account that is signed in: its secret, backup codes and spent-code marker live on that account's own row, no action takes an account id, and the secret is never sent to the browser again after setup.

Once enabled, **every** way of signing in needs the second step — email/password and Google alike: a live 6-digit code or an unused backup code. How it is protected:
- **Codes are single-use.** A code is only accepted for a 30-second step later than the last one used, so a code that was already used (or seen over a shoulder) can't be replayed; a backup code is removed the moment it works.
- **Guessing is capped.** Wrong codes count against the same 5-attempt / 15-minute lockout as passwords, and a correct password does *not* reset that counter — it only resets when the code step succeeds — so knowing the password doesn't give unlimited tries at the code.
- **Turning it off takes the password *and* a current code** (or a backup code), so neither a stolen session nor a stolen password alone can strip it. Turning it on or off signs out every other device.
- A forged or tampered "half-logged-in" cookie is rejected (it is signed, and names exactly one account).

The TOTP implementation (`src/lib/totp.ts`) is a from-scratch RFC 6238 implementation with no third-party dependency for the cryptographic core, checked against the RFC's own test vectors.

## Finance

`/admin/finance` (admin only) is the shop's books. Four tabs — **Overview · Sales · Expenses · Statement** — each with a date-range picker (This month, Last month, Last 30/90 days, This year, All time, or any from–to dates, in Bangladesh time). The whole section speaks four numbers:

- **Total Sales** — revenue: what customers paid for the orders that count (products after discounts, plus delivery charged).
- **Buying Cost** — what the products that were sold cost to buy: each product's **Purchase cost** (Products → edit) × the units sold. Stock you buy is *not* an expense when you pay for it; it becomes a cost when it sells.
- **Expenses** — every other cost: freight and customs on a shipment, ads, rent, packaging, courier… entered under Expenses.
- **Profit** = Total Sales − Buying Cost − Expenses.

An order counts as a sale once it is **Delivered**, or has been **paid in advance**, and has not been cancelled, refunded or returned. There is no separate "cash collected" step any more: a sale is a sale when it is delivered.

- **Overview** — the four figures, a profit & loss for the period, a bar showing where Total Sales went (buying cost / expenses / profit), expenses paid by each owner, a month-by-month table, and shortcuts to record an expense or a sale. A yellow notice appears if some sold units have no Purchase cost (Profit is then overstated).
- **Sales** — *every* sale as a row: date, order number, customer, products (with SKU), status, payment, total, buying cost and profit. Orders from the website appear on their own; **click any row to open that order under Orders with its full details.** Filter by source (website / recorded), by the order statuses the shop already uses — **Not Cleared Yet · Sent For Delivery · Delivered · Cancelled · Refunded · Returned** — or search by customer, order number, phone, product name, **SKU**, size or colour. **Record a sale made outside the website** (Instagram, in person…): the product box finds a product by *any* detail — name, SKU, size, colour, category, price, even "low stock" — and the sale takes its stock off the shelf. A recorded sale **is an order** (number `MS-…`, tagged *Recorded*): it appears in Orders, moves through the same statuses, can be edited or deleted from its order page, and never sends the customer an email. Tick rows to delete recorded sales, or to take orders out of the finance reports (e.g. test orders) and restore them later.
- **Expenses** — top-right is **New expense category**: categories only exist once you create them there (there are no built-in ones), and then they appear in the category drop-downs. Rename any time; a category that has expenses can't be deleted (you're told why). Each recorded expense is **one row showing everything** — date, category, what it was for, notes, paid to, payment method, which owner paid, amount, who recorded it — nothing hides behind a click. Payment methods: Cash, bKash, Bank, Card, Other. **Owners** (collapsed panel) are the people who pay for things; filter the list by owner or category, or search.
- **Statement** — a formal **Statement of Income & Expenses** for any period, laid out as accountants expect: letterhead with the store's details, statement number, period, date issued and currency; key figures; a **statement of profit or loss** with note references and % of sales (deductions in brackets, totals ruled off, profit double-underlined); **Schedule A — Sales** and **Schedule B — Expenses** listing every entry behind the figures; **Notes** that state the basis (what counts as a sale, how Buying Cost is worked out, what isn't counted yet, orders left out); and *Prepared by* / *Reviewed and approved by* signature lines. Choose the contents (full / summary only / summary + one schedule), then **Open printable statement / PDF** (A4, the store name, statement number and "Page x of y" in every page's footer — use the browser's Print → Save as PDF) or **Download CSV**. The preview, the print view and the CSV are all drawn from one model, so they can never disagree.

If anything can't be done, the screen says **why**, next to what you clicked — see *When something goes wrong* below.

## Inventory

`/admin/inventory` (admin **and** staff — staff don't see buying costs) is for looking stock up and updating it quickly, and sits outside Finance.

- **The top strip** shows the total inventory: units in stock, **Inventory at buying cost** (admin only), **Worth when sold** at today's selling prices (discounts included), the profit that would make (admin only), and how many sizes are low or sold out.
- **Every product is a row**: photo, name, category, the sizes in stock with a count each (amber = low, red = none), total units, what that stock cost to buy, and what it will fetch when sold. Search by name, SKU, size, colour, category or tag; filter to low stock / sizes sold out / nothing left; sort by name, what needs restocking first, units or worth.
- **Click a row** and a semi-transparent menu opens over the list with **every size and colour**: the count, a *LOW STOCK / SOLD OUT* marker, its worth, and a box to **add stock** — type a number and press Enter, or tap +1 / +5 / +10 then Add. *More* lets you **remove** units (a reason is required — damaged, lost, miscounted) or do a **stock-take** (set the exact count on the shelf). Below is the product's **recent stock history**: when, which size, the change, the new count, why (sale, restock, correction…), and who.

### Stock stays in sync everywhere

Stock is changed from several places — website checkout, order cancellations/refunds/failed payments, recorded sales, the Inventory screen, the product editor — so there is exactly **one code path that changes it** (`src/lib/stock.ts`), and it is built so two things happening at once can never corrupt a count:

- Every change is a **delta applied in one atomic database statement** (`stock = stock + n`, refused if it would go below zero) — never "read the number, then write a number" — so a sale landing at the same moment as a restock, or two people editing, can't overwrite each other or oversell.
- A **stock-take** is only accepted if the count is still what you saw when you opened it; if someone else changed it meanwhile you are told the current number and nothing is overwritten.
- **Every change leaves a history row** (`StockMovement`) in the same transaction, so each size's history always adds up to its count — and the database itself refuses a negative count. If the two ever disagree (they should not), the Inventory page shows a banner and an admin can repair the history.
- After a change, the storefront's sold-out/preorder badges and the admin screens refresh, and "back in stock" emails are sent when a size goes from none to some — whichever screen caused it.

### When something goes wrong

Every action in Finance, Inventory and Orders answers with a reason in plain words next to what you clicked — "Not enough stock: only 3 left of …", "That category already exists", "This order has already been delivered; refresh to see its current state". A dropped connection or a site update in the middle of a click shows "Couldn't reach the server, so nothing was saved…" instead of an error page, and nothing is lost on the screen.

## Motion & lighting

The storefront carries a small ambient/interactive motion layer, all opt-out via `prefers-reduced-motion` (CSS-driven effects are neutralized automatically by the global reduced-motion rule in `globals.css`; JS-driven ones check `window.matchMedia` themselves):

- **Background wall** — a fixed scatter of the site's own circle/square/X marks (`.site-wall` in `globals.css`, same fixed-div pattern as the film grain, mounted once in the storefront layout, negative `z-index` so it always stays behind content). Tuned to read clearly as a deliberate wallpaper without competing with foreground content.
- **Crayon scribble accents** — `CrayonScribble.tsx`, a fan of textured crayon strokes (SVG `feTurbulence`/`feDisplacementMap` for the hand-drawn roughness) scattered across open space on the homepage hero, the three homepage section headers, the gender-hub PLP header, and the footer — each a distinct brand color, each `id` unique per page for its SVG filter.
- **Film grain** — a fixed, near-invisible animated grain overlay (`.site-grain` in `globals.css`, mounted once in the storefront layout).
- **Marquee ticker** — an endless-scroll brand strip (`MarqueeTicker.tsx`) between the header and page content. Its headlines are admin-editable from `/admin/content`'s "Marquee ticker" panel (3–5 lines, any length) instead of hard-coded.
- **Magnetic buttons** — `Button.tsx` pulls slightly toward the cursor on hover (pointer-move only, skipped on touch) with a lime glow; falls back to the existing CSS hover styles with the pointer away or reduced motion on.
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

- The free-delivery tag is presentational only; making it actually waive the shipping fee would mean threading it into `src/actions/checkout.ts`'s shipping-cost calculation.
- OAuth account linking is by email match — if someone's Google email differs from the email on their existing password account, they'll get a second, separate account rather than a merge prompt.
