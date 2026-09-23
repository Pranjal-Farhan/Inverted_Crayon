# Inverted Crayon

Streetwear storefront + admin, built from the [Build Specification v1.0](.) — Next.js 16 (App Router), TypeScript, Tailwind v4, Prisma 7 / PostgreSQL.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack, Server Actions)
- **Database**: PostgreSQL via Prisma 7 (`@prisma/adapter-pg` driver adapter)
- **Styling**: Tailwind CSS v4, design tokens in `src/app/globals.css` matching Build Spec §02–§04
- **Auth**: Signed JWT session cookies (`jose`) — separate admin and customer sessions, no third-party auth provider
- **Payments**: Mocked (bKash / Nagad / SSLCommerz / COD are selectable at checkout; non-COD orders are marked paid immediately, no real gateway calls)
- **Emails**: Mocked — every "send" writes to an `EmailLog` outbox (viewable at `/admin/emails`) instead of calling a real provider. See `src/lib/mail.ts`.

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

## Deploying to a real server

- **`SESSION_SECRET` is required in production** — the app refuses to start without it (`src/lib/session.ts`) rather than silently signing session cookies with a well-known fallback. Generate one with `openssl rand -base64 48`.
- **`DATABASE_URL`** must point at your production Postgres (managed providers' `?sslmode=require` connection strings work as-is). The app also refuses to start without it.
- **Don't run `npx prisma db seed` against production** — it's a demo dataset with known test-account passwords (see the table above) and refuses to run when `NODE_ENV=production` unless you explicitly set `ALLOW_PRODUCTION_SEED=true` (and, for the admin account specifically, `ADMIN_EMAIL`/`ADMIN_PASSWORD` of your choosing). Run `npx prisma migrate deploy` to apply the schema instead, then create your real admin user by hand.
- **Admin/customer login lock out after 5 failed attempts** for 15 minutes per account (`src/lib/login-lockout.ts`) — there's no rate limiting in front of the app otherwise (no WAF/CDN assumed), so this is the only brute-force guard.
- **Security headers** (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, a permissive-by-default `Permissions-Policy`, and HSTS when served over HTTPS) are set for every response in `src/proxy.ts`. No CSP is set — add one if you need it, testing carefully since a wrong CSP silently breaks pages rather than erroring.
- **Checkout is safe under concurrent load**: stock decrements and discount-code redemptions use guarded atomic updates inside the order transaction (not read-then-write), so two simultaneous checkouts for the last unit of stock (or the last use of a limited coupon) can't both succeed — one gets a clear "not enough stock" / "code fully redeemed" error instead of silently overselling.
- **Product photo uploads are local disk** (`public/uploads/products/<id>/`), fine for a persistent VPS/container with a stable filesystem, but they will not survive a serverless or ephemeral-disk deploy (e.g. plain Vercel) or work correctly if you run multiple app instances behind a load balancer without a shared volume — swap in S3/Cloudinary-backed storage first if that's your target.

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

## Notes for further work

- Product/model photography: seeded products use a styled placeholder (`PlaceholderFrame`) until real photos are uploaded. Admin → product editor supports dragging (or click-to-browse) images onto a product — files save to `public/uploads/products/<id>/` and render on the PDP gallery, product cards, and grids in place of the placeholder. Uploads are local disk storage, not a CDN/object store — fine for local dev, swap for S3/Cloudinary-backed storage before deploying anywhere with ephemeral or multi-instance filesystems.
- Payments are mocked; wiring real bKash/Nagad/SSLCommerz sandbox APIs would replace the payment-status logic in `src/actions/checkout.ts`.
- Emails are mocked to an outbox table rather than actually sent — swap the body of `sendMail()` in `src/lib/mail.ts` for a real provider (SES/SendGrid/etc.) and every call site (order events, back-in-stock, abandoned checkout, newsletter, contact) keeps working unchanged.
- Abandoned-checkout reminders are admin-triggered (`/admin/campaigns` → "Send all pending reminders") rather than on an automatic schedule — wire that button's action (`sendAllAbandonedReminders` in `src/actions/admin-marketing.ts`) into a cron job for real automation.
