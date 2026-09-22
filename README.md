# Inverted Crayon

Streetwear storefront + admin, built from the [Build Specification v1.0](.) — Next.js 16 (App Router), TypeScript, Tailwind v4, Prisma 7 / PostgreSQL.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack, Server Actions)
- **Database**: PostgreSQL via Prisma 7 (`@prisma/adapter-pg` driver adapter)
- **Styling**: Tailwind CSS v4, design tokens in `src/app/globals.css` matching Build Spec §02–§04
- **Auth**: Signed JWT session cookies (`jose`) — separate admin and customer sessions, no third-party auth provider
- **Payments**: Mocked (bKash / Nagad / SSLCommerz / COD are selectable at checkout; non-COD orders are marked paid immediately, no real gateway calls)

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

## Project structure

```
prisma/schema.prisma          data model (§10 of the spec, extended)
prisma/seed.ts                catalog + orders + accounts seed
src/app/(storefront)/         public site — home, PLP/PDP, cart, checkout, account, legal
src/app/admin/                admin app — dashboard, orders, products, inventory, CRM, settings
src/actions/                  server actions (checkout, admin CRUD, auth)
src/components/                brand, ui, layout, storefront, admin component libraries
src/lib/                      domain logic — tag/pricing derivation, cart, sessions, settings
```

## Build phases

Both P1 (launch-critical) and P2 (fast-follow) from the spec's §13 checklist are implemented:

- **P1**: design system, storefront browse/PDP, cart → guest checkout → confirmation → track order, admin dashboard/orders/products/inventory/categories/settings, all legal/utility pages.
- **P2**: customer accounts (register/login/orders/returns/wishlist/back-in-stock — guest orders auto-claim on registration), drops/collections landing, lookbook, admin CRM/discounts/campaigns/content CMS/analytics/reviews.

## Notes for further work

- Product/model photography: every image is a styled placeholder (`PlaceholderFrame`) — swap in real assets at the same aspect ratios noted per page in the spec.
- Payments are mocked; wiring real bKash/Nagad/SSLCommerz sandbox APIs would replace the payment-status logic in `src/actions/checkout.ts`.
- Emails (order confirmation, shipping, back-in-stock, etc.) are not sent — the spec's §11 event list is a ready-made checklist for adding a transactional email provider.
