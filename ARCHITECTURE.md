# Inverted Crayon — Architecture & Philosophy

This is the deep-dive reference for this codebase: every model, every route, every server action, how they connect, and *why* things are built the way they are. `README.md` is the quickstart; this is the map for actually working in the code.

Written for a reader who knows web development but has never seen this repo. Every claim below was checked directly against the source at the time of writing (not recalled from memory) — file paths are given throughout so you can jump straight to ground truth.

---

## 1. What this is

A full streetwear e-commerce site — storefront + admin panel — for a brand called **Inverted Crayon**. One Next.js app, one Postgres database, no microservices, no separate API layer. Customers browse, buy, track orders, review, wishlist, and get emailed. Admins manage catalog, inventory, orders, marketing, and site content, all from `/admin`.

Payments (bKash, card via SSLCommerz), email (Resend), and social login (Google, Facebook) are all **wired for real** but gracefully fall back to safe mocks when their credentials aren't configured — see §14 and §21. This is the single most important architectural idea running through the whole codebase, so it gets called out early: **every third-party integration is built to its real shape first, with a mock fallback, never the other way around.** Nothing here is a stub that merely *looks* real; the bKash/SSLCommerz/Resend/OAuth code paths are the actual integration code a production deploy would use.

---

## 2. Design philosophy

### 2.1 The brand concept

"Inverted Crayon" — the wordmark (`src/components/brand/Wordmark.tsx`) renders "INVERTED" in white and "CRAYON" letter-by-letter in a fixed color cycle (pink → cyan → yellow → lime → pink → cyan). The tagline across the site is a variation on "invert the ordinary" / "stand out." The name itself is the design brief: everything is a deliberate inversion of a "normal" e-commerce site's polish.

That inversion shows up structurally, not just verbally:

- The **storefront and admin panel are both dark** (`bg-ink` `#0c0c0d`), but the **printable receipt is light** (`bg-paper`) — a literal inversion, and a practical one (nobody wants a black receipt eating printer ink).
- Product imagery defaults to **hand-drawn placeholder graphics** (`PlaceholderFrame` + `Scribble`, an SVG scribble shape — x/circle/square/underline/arrow) rather than a "coming soon" gray box, so the site never looks broken before real photography is uploaded.
- Buttons are **rotated -1° with a hand-drawn underline** (`.btn-primary` in `src/app/globals.css`) — a deliberate "not quite square" imperfection against an otherwise strict grid.
- Sharp corners everywhere (`* { border-radius: 0 }` at the top of `globals.css`) — pills are opt-in via `rounded-full`, never the default. This is a hard constraint of the visual system, not a preference.

### 2.2 Visual language

**Color** (`src/app/globals.css`, `:root` block) — a small, fixed palette, never extended ad hoc:

| Token | Hex | Role |
|---|---|---|
| `--color-ic-ink` | `#0c0c0d` | Base background (storefront + admin) |
| `--color-ic-panel` / `panel-2` | `#151517` / `#1b1b1e` | Card/panel surfaces, two tones for layering |
| `--color-ic-line` / `line-2` | `#2a2a2e` / `#3a3a3f` | Borders, two weights |
| `--color-ic-white` | `#f4f4f1` | Primary text / "paper" (the receipt background) |
| `--color-ic-lime` | `#c3f53a` | Primary action color — buttons, active states, prices |
| `--color-ic-pink` | `#ff2d84` | Accent — "New" tag, brand accents |
| `--color-ic-cyan` | `#26a7e6` | Accent — links, "Limited" tag |
| `--color-ic-yellow` | `#ffd23b` | Accent — preorder, sale price emphasis |
| `--color-ic-error` | `#ff4d4d` | Errors, destructive actions, "Sale" tag |

These are mapped into Tailwind's theme via `@theme inline` (Tailwind v4's CSS-first config) so they're usable as `bg-lime`, `text-cyan`, etc. directly.

**Typography** — four typefaces, each with one job, never mixed:

- `--font-impact` (Anton) — headings, prices, primary buttons. Loud and condensed.
- `--font-scrawl` (Permanent Marker) — the hand-drawn voice: the wordmark, section headers ("Collections", "New In"), the footer's "Stay Inverted" motto, review stars context.
- `--font-label` (Bebas Neue) — all-caps UI labels: nav links, form labels, tag pills, table headers. Always paired with wide letter-spacing (`tracking-[1.2px]` to `tracking-[2px]`).
- `--font-body` (Archivo) — everything else: descriptions, paragraph copy.

**Motion** (`src/app/globals.css`, added in the production-readiness pass — see §18) — a global transition rule on all interactive elements (`a, button, input, select, textarea, [role="button"]`) so hover/focus states animate instead of snapping, plus a `prefers-reduced-motion` override that collapses all animation durations to ~0 for anyone who's asked for it at the OS level. Specific components layer on top of this: product-card image hover-zoom, an animated (not instant) desktop nav dropdown, fade-in overlays (search, notify-me modal), and a `animate-pulse` on the live-sale indicator dot.

### 2.3 The derived-state philosophy

The single most important domain-logic decision in this codebase: **tags are split into "stored" and "derived," and the split is deliberate, not incidental.**

- `NEW`, `PREORDER`, `LIMITED`, `BESTSELLER` are stored rows (`ProductTag`, admin-editable checkboxes on the product form).
- `SALE` is **never stored** — it's computed from whether an active `Campaign` currently targets that product/category (`findActiveCampaign` in `src/lib/product-view.ts`).
- `SOLD_OUT` is **never stored** — it's computed from summed variant stock.
- "New" is *also* auto-derived as a fallback: a product counts as new for 21 days after `publishedAt`, even with no explicit `NEW` tag (`NEW_WINDOW_DAYS` in `product-view.ts`).

All of this funnels through exactly one function: `deriveProductDisplay()` in `src/lib/product-view.ts`. Every surface that needs to know "is this on sale / sold out / new" — product cards, PLP, PDP, homepage, cart, checkout's price calculation — calls this same function. There is no second implementation anywhere. This is why the price a customer sees on a card matches exactly what checkout charges: it's the same code path, not two implementations kept in sync by hand.

---

## 3. Tech stack, and why

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack, Server Actions) | Server Components fetch straight from Prisma with no separate REST/GraphQL layer; Server Actions are the only "API" this app has — see §6. |
| Database | PostgreSQL via Prisma 7, `@prisma/adapter-pg` driver adapter | Prisma 7 *requires* an explicit driver adapter (no more implicit connection strings) — `src/lib/db.ts` constructs the `pg` pool explicitly. |
| Styling | Tailwind CSS v4, tokens in `src/app/globals.css` | CSS-first `@theme inline` config, no `tailwind.config.js`. |
| Auth | Hand-rolled JWT session cookies (`jose`), not NextAuth | Two independent cookie-based sessions (admin, customer) with a tiny, fully-owned surface — see §7. |
| Validation | `zod` on every server action input | Nothing trusts client-shaped data; every action schema-validates before touching the database. |
| State | React Context + `useState`, no Redux/Zustand | Cart and toast state are small and local; a heavier state library would be unjustified weight. |

The dependency list (`package.json`) is deliberately lean: 9 runtime dependencies total, no UI kit, no animation library, no ORM beyond Prisma, no HTTP client beyond `fetch`. Payment/OAuth/email integrations are all hand-written against the providers' plain REST APIs (see §14, §7.3, §13) rather than pulled in as SDKs — this keeps the bundle small and the integration code fully auditable in this repo rather than living inside a dependency.

---

## 4. Repository layout

```
prisma/
  schema.prisma              the entire data model — see §5
  seed.ts                    demo dataset (catalog, orders, accounts, journal posts)
  migrations/                one directory per schema change, applied in order

src/
  app/
    (storefront)/            public site — route group, no /storefront in the URL
      layout.tsx              fetches the homepage hero block, wraps Header/Footer
      page.tsx                 homepage
      product/[slug]/          PDP
      men/, women/              gender hubs + /men/[category], /women/[category]
      cart/, checkout/          cart page, checkout page
      account/                  customer auth (login/register) + (protected)/ route group
      journal/                  blog list + post
      drops/[slug]/             collection landing pages
      ...
    admin/
      (dashboard)/             everything under the sidebar+topbar admin chrome
      (receipt)/               the printable order receipt — deliberately OUTSIDE (dashboard)
                                so it renders with no admin chrome (see §10.13)
      login/                   admin login (outside both route groups — no session required)
    api/
      auth/[provider]/         OAuth start + callback routes (google | facebook)
      payments/                bKash + SSLCommerz callback routes
      discount/                live promo-code validation endpoint (used by usePromoValidation)
      products/by-ids/         batch product lookup (recently-viewed rail)
      search/suggest/          live search suggestions
    proxy.ts                  Next 16's replacement for middleware.ts — security headers on every response

  actions/                    every "use server" mutation, one file per domain
                               (checkout, admin-*, customer-*, back-in-stock, contact, newsletter)
                               admin-2fa.ts       2FA setup/confirm/disable
                               admin-finance.ts   stock owners + stock purchases (inventory ledger)

  components/
    storefront/                customer-facing UI
    admin/                     admin-panel UI
    layout/                    Header, Footer, CartDrawer, SearchOverlay, ChatBubble
    ui/                        generic building blocks (Button, ProductCard, TagPill, Accordion)
    brand/                     Monogram, Wordmark, Crown, Scribble — pure SVG, no external assets
    auth/                      OAuthButtons

  context/                    CartProvider, ToastProvider (client-side React Context)

  lib/                        domain logic with no JSX — see §6 for the pattern
    db.ts                      Prisma client singleton
    session.ts                 JWT cookie sessions
    product-view.ts            deriveProductDisplay — the single source of truth (§2.3)
    plp.ts / parse-plp-params.ts / plp-url.ts   PLP filtering/sorting/pagination + URL-state helpers
    discount.ts                 discount-code validation rules
    mail.ts                     the email outbox + optional real send
    sms.ts                      the order-confirmation SMS outbox + optional real send
    money.ts                    Taka formatting + Decimal-to-number conversion
    order-number.ts             human-facing order number generator
    login-lockout.ts            shared brute-force guard for admin + customer login
    totp.ts                     RFC 6238 TOTP (Google Authenticator-compatible 2FA) — hand-rolled, no dependency
    oauth/                      google.ts, facebook.ts — provider-specific OAuth code
    payments/                   bkash.ts, sslcommerz.ts, rollback.ts
    email-provider.ts           Resend integration
    sms-provider.ts             SSL Wireless SMS Plus integration
    site-url.ts                 resolves the app's own origin for callback URLs
    hero-defaults.ts            homepage CMS default content + types
    store-settings.ts           typed StoreSetting (JSON-in-DB) accessors
    cart-types.ts                Cart/CartLine types + pure helper functions
    categories.ts                the fixed 8-category list shared by men/women

  generated/prisma/           Prisma Client output — gitignored, built by `prisma generate`

public/
  uploads/                    admin-uploaded images (product photos, site logo/hero) — gitignored,
                              local disk, not committed — see §12
```

---

## 5. Data model

Full schema: `prisma/schema.prisma`. Every model below, grouped the way the schema file itself groups them, with the *why* for anything non-obvious.

### 5.1 Catalog

- **`Product`** — the core listing. `status` (`DRAFT`/`ACTIVE`) gates storefront visibility everywhere (every storefront query filters `status: "ACTIVE"`). `freeDelivery` (`NONE`/`INSIDE_DHAKA`/`NATIONWIDE`) drives the PDP delivery tag (§8.4). `publishedAt` is stamped once, on first activation, never re-stamped on later edits — this is what makes the 21-day "New" window (§2.3) mean anything.
- **`Variant`** — size × color, uniquely constrained on `(productId, size, color)`. `stockQty` is the single number every stock check reads; `lowStockThreshold` drives the admin dashboard's "Low stock" KPI. `preorderAdvanceAmount` (nullable) is the whole preorder philosophy in one field — see §9.6.
- **`ProductImage`** — ordered (`position`) list per product, up to 20 (§12). An empty `url: ""` is the seed data's placeholder sentinel — `PlaceholderFrame` renders instead of an `<img>` wherever `url` is falsy.
- **`Category`** — one flat list of 8, shared by both genders (`src/lib/categories.ts` — the hard-coded canonical list, matching seeded `Category.slug` values). Gender is a *filter*, not a separate category tree — an explicit Build Spec decision recorded in the schema comment.
- **`Collection`** / **`ProductCollection`** — curated drop pages (`/drops/[slug]`), many-to-many with Product, independently schedulable (`startsAt`/`endsAt`) and toggleable (`active`).
- **`Tag`** / **`ProductTag`** — see §2.3. `ProductTag.meta` is a free JSON field, used today for exactly one thing: `{ shipDate: "..." }` on a `PREORDER` tag.

### 5.2 Customers

- **`Customer`** — `passwordHash` is nullable (OAuth-only accounts have none). `googleId`/`facebookId` are unique-nullable — the link fields for social login (§7.3). `failedLoginCount`/`lockedUntil` back the login-lockout guard (§7.2). `segmentTags` is a free-form string array for CRM segmentation, shown in the admin customer list.
- **`Address`** — one-to-many, `isDefault` flag enforced in the action layer (`saveAddress` in `customer-profile.ts` un-defaults all others before setting a new default).

### 5.3 Orders

- **`Order`** — the biggest model. Money fields (`subtotal`, `shippingCost`, `discountAmount`, `total`, `advanceAmount`, `balanceDue`) are all `Decimal(10,2)`, never floats, at the storage layer (application-layer arithmetic still uses plain `number`, rounded after every step — see §9.5's note on this). `status` (`OrderStatus`) tracks *fulfillment* (PENDING → PAID → PROCESSING → SHIPPED → DELIVERED, or CANCELLED/REFUNDED/RETURNED); `paymentStatus` tracks *payment* independently (PENDING/PAID/FAILED/REFUNDED). `paymentTransactionId` is the gateway's own reference (bKash `paymentID`, SSLCommerz `val_id`) for reconciliation. The `advancePercent`/`advanceAmount`/`balanceDue`/`balanceCollected` group exists only for preorders — see §9.6.
- **`OrderItem`** — deliberately **denormalized**: `productTitleSnapshot` and `variantLabelSnapshot` freeze the product's name/variant label *as it was at purchase time*, independent of `productId`/`variantId` (both nullable, so an order survives a product later being deleted). This is why a receipt or order-history page never shows a renamed or deleted product's current title — it shows what the customer actually bought. `preorderAdvanceAmount` is the same snapshot idea applied to §9.6's per-unit advance.
- **`ReturnRequest`** / **`ReturnItem`** — a return references specific order items, not the whole order.

### 5.4 Marketing

- **`Discount`** — coupon codes. `type` is `PERCENT`/`FIXED`/`FREE_SHIPPING`. `usageLimit`/`usedCount` gate total redemptions; `firstOrderOnly` + `minSpend` are additional gates, all enforced server-side in `src/lib/discount.ts`'s `validateDiscountCode()` — see §9.4 for how the count itself is protected from a race.
- **`Campaign`** — automatic sales, no code needed. Targets either a category (`targetCategoryId`) or an explicit product-ID list (`targetProductIds`), with a mandatory time window (`startsAt`/`endsAt`, both non-nullable — a campaign can't run forever by accident). This is the *only* mechanism that sets `onSale`/`salePrice` on a product (§2.3).
- **`Review`** — `@@unique([productId, customerId])` at the database level (added specifically to close a double-submit race — see §16.1). `customerId` is nullable so the constraint doesn't collapse multiple non-customer reviews into one.
- **`WishlistItem`** — `notifiedAt` drives the back-in-stock-for-wishlisted-items email (§13.2); it's reset to `null` whenever the product goes fully out of stock again, so a later restock re-notifies.
- **`BackInStockSubscription`** — the explicit "Notify me" click on a sold-out variant, unique per `(email, variantId)`.

### 5.5 Admin / CMS

- **`AdminUser`** — `role` is `ADMIN` or `STAFF` (no finer-grained permissions today — see §10.12 for what STAFF can't do). Same OAuth-link fields as Customer, with one critical asymmetry: OAuth sign-in for this model **never creates a row** — see §7.3. `twoFactorSecret`/`twoFactorEnabled`/`twoFactorBackupCodes` back TOTP 2FA (§7.5) — a secret can exist while `twoFactorEnabled` is still `false` (mid-setup, QR shown but not yet confirmed); backup codes are stored bcrypt-hashed, each single-use.
- **`StockOwner`** / **`StockPurchase`** — the inventory finance ledger (§10.4a). `StockOwner` is just who funds stock (name/contact/notes). `StockPurchase` follows the same denormalized snapshot pattern as `OrderItem` (§5.3): `productTitleSnapshot`/`variantLabelSnapshot` freeze the product's identity at purchase time, and `productId`/`variantId` are nullable (`onDelete: SetNull`) so a purchase record survives the product/variant later being deleted. `ownerId` is `onDelete: Restrict` — an owner with recorded purchases can't be deleted out from under its financial history. Recording a purchase increments `Variant.stockQty` in the same transaction, making this the accountable counterpart to `setVariantStock`'s manual correction (§10.4).
- **`ContentBlock`** — a generic `key → JSON` slot store. Today used for exactly two keys: `home_hero` (the full homepage CMS payload — brand identity, hero text, images, background) and `home_featured_drop` (`{ productId }`). New CMS slots (e.g. a "men hero", per the code's own comment) would follow the same pattern.
- **`StoreSetting`** — same `key → JSON` shape as `ContentBlock`, used for store-wide operational settings instead of content: `shipping_rates`, `payment_gateways`, `store_info`, `tax_settings`, `email_templates`, `chat_widget`. Typed accessors for every key live in `src/lib/store-settings.ts` (`getShippingRates()`, etc.), each with a hard-coded default so a fresh database with no seeded settings still renders something sane.
- **`Post`** — the journal/blog, independently publishable (`PostStatus`, `publishedAt` stamped once on first publish, same pattern as `Product`).

### 5.6 Email, SMS & abandoned-checkout

- **`EmailLog`** — the outbox. Every `sendMail()` call writes one row here *unconditionally*, whether or not a real provider is configured (§13).
- **`SmsLog`** — same outbox shape as `EmailLog`, for order-confirmation SMS (§13a). `relatedOrderId` is a plain string (the order number), not a real FK, same reasoning as `EmailLog.relatedOrderId`: the log should survive an order later being deleted.
- **`AbandonedCheckout`** — one row per email address (unique), holding a JSON snapshot of the cart at the moment the customer typed their email into checkout and blurred the field. Cleared automatically on a completed order for that email.

---

## 6. Request & data-flow architecture

There is no REST or GraphQL API for the app's own data. Two mechanisms only:

1. **Server Components read the database directly.** A page like `src/app/(storefront)/product/[slug]/page.tsx` is an `async function` that calls `db.product.findUnique(...)` (via `src/lib/get-product.ts`'s `getProductForPDP()`) at render time, on the server, and passes plain data down to client components as props. There is no fetch, no loading spinner for this — it's resolved before the HTML streams.
2. **Server Actions mutate the database and call `revalidatePath()`.** Every file in `src/actions/` starts with `"use server"`. A client component calls one of these functions directly (via `startTransition` for optimistic-ish UX, or `useActionState` for form actions) — no fetch, no JSON serialization to hand-write, no route handler to define. The action does its own `zod` validation, its own auth check (`requireAdmin()`/`requireCustomer()` helpers repeated at the top of nearly every action file), the database write, and finally `revalidatePath()` on whatever pages just went stale.

The three exceptions — actual `route.ts` files under `src/app/api/` — exist only where a Server Action genuinely can't do the job:

- **OAuth callbacks** (`api/auth/[provider]/{start,callback}`) — an external provider redirects the browser here with a `code` query param; this has to be a real HTTP endpoint the provider can hit.
- **Payment gateway callbacks** (`api/payments/{bkash,sslcommerz}/...`) — same reason: bKash/SSLCommerz redirect or POST back to a URL they were given at session-creation time.
- **`api/discount`, `api/products/by-ids`, `api/search/suggest`** — plain `fetch()`-based endpoints called from client-side hooks (`usePromoValidation`, the recently-viewed rail, `useSearchSuggestions`) that need to poll/debounce independent of a full page navigation.

**Server vs. Client components**: the default is Server. A component only gets `"use client"` when it genuinely needs browser state or interactivity — forms with local input state, anything reading `localStorage` (cart, recently-viewed), anything with a hover/open/closed toggle (nav dropdowns, drawers, accordions), anything using a React Context. Every admin "manager" component (`ProductEditorForm`, `DiscountManager`, `CampaignManager`, etc.) is client-side because they're all stateful CRUD forms; the *pages* that load their initial data and pass it in as props are Server Components.

---

## 7. Auth & sessions

### 7.1 The cookie system

`src/lib/session.ts` — two independent, symmetric session types, both signed JWTs (HS256, via `jose`) in `httpOnly`, `sameSite: lax`, 30-day cookies:

- `ic_admin_session` → `{ adminId, email, name, role }`
- `ic_customer_session` → `{ customerId, email, name }`

`secure: true` is set automatically whenever `NODE_ENV === "production"`. The signing secret comes from `SESSION_SECRET`; **the app refuses to start in production without it** (throws at module-load time) rather than falling back to a hardcoded value — a real vulnerability that existed here once and was fixed (see §18's audit).

There's no session revocation list — logging out just deletes the cookie; a stolen cookie stays valid until it expires or `SESSION_SECRET` is rotated (which invalidates everyone). This is a known, accepted limitation for a project this size, not an oversight — see §21.

### 7.2 Login lockout

`src/lib/login-lockout.ts` — the *only* brute-force guard in the app (there's no rate limiting anywhere else, no WAF assumed). Shared by both `adminLogin` and `customerLogin` (`src/actions/admin-auth.ts`, `src/actions/customer-auth.ts`):

- 5 failed attempts locks that specific account for 15 minutes (`MAX_LOGIN_ATTEMPTS`, `LOCKOUT_MINUTES`).
- The lock is checked **before** password comparison — so the 6th attempt is rejected even with the *correct* password, closing a timing/enumeration gap.
- A non-existent email never touches the failure counter (can't lock out an account that doesn't exist) and returns the same generic "Invalid email or password" message either way, so login failures don't leak whether an email is registered.
- A successful login resets the counter to 0.

### 7.3 OAuth (Google + Facebook)

Hand-rolled Authorization Code flow, no SDK (`src/lib/oauth/google.ts`, `src/lib/oauth/facebook.ts`), routed through one shared pair of dynamic routes: `src/app/api/auth/[provider]/start/route.ts` and `.../callback/route.ts`.

**The flow:**
1. Browser hits `/api/auth/google/start?intent=customer` (or `intent=admin`).
2. The route generates a random `state` UUID, sets it in an `httpOnly` cookie (`oauth_state`) alongside the `intent` (`oauth_intent`), and redirects to Google's/Facebook's consent screen with that `state` embedded.
3. The provider redirects back to `/api/auth/google/callback?code=...&state=...`.
4. The callback checks `state` against the cookie (CSRF protection — a forged callback without the matching cookie is rejected), reads `intent` back out, exchanges `code` for an access token, fetches the user's profile (id + email + name), then:
   - **`intent=customer`**: find-or-create a `Customer` row (match by `googleId`/`facebookId` first, then by email — linking an existing password account to the OAuth id on first match), claim any guest orders under that email (same as password registration does), set the customer session cookie, redirect to `/account`.
   - **`intent=admin`**: find an **existing** `AdminUser` by OAuth id or email. **If none exists, it does not create one** — it redirects back with `?oauth=no_account`. This is the one deliberate asymmetry between the two intents, and it exists for a specific reason: allowing OAuth to self-register an admin account would let *anyone with a Google account* grant themselves store-admin access. Admin/staff accounts can only ever be created by an existing admin (`inviteStaff` in `src/actions/admin-staff.ts`) or the seed script; OAuth can only ever be a second way to *log in* to an account that already exists.

When `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (or the Facebook equivalents) aren't set, `googleConfigured()`/`facebookConfigured()` return false and the `start` route redirects straight back with `?oauth=not_configured` — the buttons are always visible (`src/components/auth/OAuthButtons.tsx`, rendered on `/account/login`, `/account/register`, `/admin/login`) but degrade to a clear message instead of a broken redirect.

### 7.4 Security headers

`src/proxy.ts` (Next.js 16's renamed `middleware.ts` — the framework flags the old filename as deprecated, and this repo follows that) sets on every response: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a locked-down default `Permissions-Policy`, and HSTS when served over HTTPS. No CSP is set (deliberately — a wrong CSP silently breaks pages rather than erroring, and none was judged necessary yet).

### 7.5 Admin two-factor authentication (TOTP)

Optional, per-account, email/password-login only — OAuth admin sign-in (§7.3) never asks for a 2FA code, since it's already a second factor.

- **`src/lib/totp.ts`** — a from-scratch RFC 6238 implementation (HMAC-SHA1 HOTP, 30s step, 6 digits, RFC 4648 base32) with no third-party dependency for the cryptographic core, so the secret never passes through code this repo didn't write. `verifyTotpCode` accepts the current 30s step plus one step either side, to tolerate normal clock drift. `generateBackupCodes()` produces 8 human-typeable one-time codes (e.g. `7K3F-9QXZ`), stored bcrypt-hashed on the `AdminUser` row and each usable once.
- **Setup** (`src/actions/admin-2fa.ts`, UI in `TwoFactorSetup.tsx` under `/admin/settings` → Security): `initiateTwoFactorSetup()` generates and saves a secret (without enabling enforcement) and returns a QR code — rendered as a data URI via the `qrcode` package, generated entirely server-side and never transmitted to any third-party service — plus the manual base32 key. `confirmTwoFactorSetup()` verifies a code against that pending secret, and only then sets `twoFactorEnabled: true` and generates the backup codes (shown once, on this one response). `disableTwoFactor()` requires the current password and clears all three fields.
- **Login** (`src/actions/admin-auth.ts`): after a correct password, `adminLogin` checks `twoFactorEnabled`. If true, instead of setting the real session it sets a short-lived (5-minute) signed `ic_admin_2fa_pending` cookie (`{ adminId }`, same `jose`/`SESSION_SECRET` signing as the real session cookies — see §7.1) and returns `needsTwoFactor: true` rather than redirecting. `AdminLoginForm.tsx` then swaps to a second step, submitting to `verifyAdminTwoFactor()`, which reads the pending cookie, accepts either a live TOTP code or an unused backup code (bcrypt-compared and removed from the array on use), and only then sets the real session and redirects. Failed attempts at this step share the exact same lockout counter/window as password login (§7.2) — a stolen password alone still can't be brute-forced against the 6-digit code.

---

## 8. Storefront walkthrough

*(Every top-level route under `src/app/(storefront)/`. Gender/category pages, `/men` and `/women`, are thin wrappers around the shared `GenderHub`/`PLPView` components described here once.)*

### 8.1 Homepage (`page.tsx`)

Reads the `home_hero` `ContentBlock` (falls back to `DEFAULT_HERO` in `src/lib/hero-defaults.ts` when nothing's been published yet) and the `home_featured_drop` block. Renders, in order: hero (headline/eyebrow/sub-copy, optional uploaded hero-image carousel via `HeroCarousel.tsx` or a placeholder, optional background-color override), the 3 fixed collection tiles, a featured-product panel, and an 8-product "New In" grid (`deriveProductDisplay` again, §2.3). Every piece of this except the collection tiles and product grid is admin-editable — see §11.

### 8.2 PLP (product listing) — `GenderHub`, `PLPView`, `/men/[category]`, `/women/[category]`, `/new`, `/sale`, `/search`

`src/lib/plp.ts`'s `getPLPResults()` is the one query/filter/sort/paginate function behind every listing page. It fetches all matching `ACTIVE` products, runs each through `deriveProductDisplay`, then filters by tag (preorder/sale/new/limited/bestseller — all against the *derived* fields, not raw DB columns), size, color, price band, in-stock-only, sorts (newest/price-asc/price-desc/bestselling), and paginates at 24/page.

Filter/sort state lives entirely in the URL query string, not React state — `src/lib/parse-plp-params.ts` parses it, `src/lib/plp-url.ts` has pure helpers (`toggleParam`, `toggleListParam`, `setParam`) that build the *next* URL for a given filter click. This means every filter combination is a real, shareable, bookmarkable, back-button-safe URL, and the filter UI itself (`PLPView.tsx`) needs no client state at all beyond the mobile filter drawer's open/closed toggle (`FilterDrawer.tsx`, `"use client"` only for that).

### 8.3 Search (`/search`, plus the header's live overlay)

Two separate mechanisms: `SearchOverlay.tsx` (the header's ⌘/tap-triggered full-screen overlay) debounces keystrokes through `useSearchSuggestions` (`src/lib/use-search-suggestions.ts`) against `GET /api/search/suggest`, showing up to a handful of quick matches with a "see full results" fallback. Submitting (Enter, or a category chip) navigates to `/search?q=...`, which is just `PLPView` with a `q` filter — full listing, filtering, sorting all still apply.

### 8.4 PDP (`/product/[slug]`)

`getProductForPDP()` (`src/lib/get-product.ts`) fetches the product with all relations plus up to 4 related products from the same category. The page renders: `ProductGallery` (swipeable multi-image, real uploaded photos or placeholder — see §12), title/rating/price (sale-aware via `deriveProductDisplay`), tag pills, `AddToCartForm` (size/color selection, stock-aware, preorder-aware), a **free-delivery badge** when `product.freeDelivery !== "NONE"` (rendered directly under Add-to-Cart, sourced straight from the admin-set field — §5.1), wishlist button, an accordion (details/shipping/returns — static copy today), related products, a recently-viewed rail (`src/lib/recently-viewed.ts`, `localStorage`-backed), and the review list + a "write a review" prompt gated on eligibility (§16.1).

### 8.5 Cart (`/cart`) and cart state

The cart itself is **entirely client-side state**, never touching the database until checkout: `src/context/cart-context.tsx` holds `{ lines: CartLine[], promoCode }` in React state, mirrored to `localStorage` (`ic_cart_v1`) so it survives a refresh. `CartLine` (`src/lib/cart-types.ts`) snapshots everything checkout will need — title, size, color, unit price, `maxQty` — so the cart page and drawer never need to re-fetch product data just to render. `CartDrawer.tsx` is the slide-out version shown after "Add to cart"; `/cart` is the full page with a promo-code field (`PromoCodeField.tsx`, validated live against `/api/discount` via `usePromoValidation`).

### 8.6 Checkout — see §9 in full (its own section, given its size)

### 8.7 Account area (`/account`, route group `(protected)`)

Every page under `account/(protected)/` requires a customer session (checked per-page; there's no shared layout-level redirect guard beyond what each page does). `AccountNav.tsx` is the shared sidebar. Sub-pages: profile (`ProfileForm.tsx` → `updateProfile`), order history + single-order detail with `OrderTimeline.tsx` (a 5-step visual tracker, or a terminal-state message for cancelled/refunded/returned), returns (`ReturnRequestForm.tsx` → `requestReturn`, references specific `OrderItem`s), wishlist (`toggleWishlist`/`removeWishlistItem`), addresses (`AddressManager.tsx`, one-default-enforced), back-in-stock subscriptions.

Guest orders are **claimed automatically** on registration or OAuth sign-up: both `customerRegister` and the OAuth callback run `db.order.updateMany({ where: { email, customerId: null }, data: { customerId } })` — any past order placed as a guest with that email becomes visible in the new account's order history the moment they sign up.

### 8.8 `/track` and `/order/[number]`

Guest-accessible order lookup/confirmation — no login required, since a guest checkout has no account to view an order history from. `/order/[number]` is the post-checkout confirmation page.

### 8.9 Journal (`/journal`, `/journal/[slug]`)

The blog. Public list/detail pages read `Post` rows with `status: "PUBLISHED"`; the admin side (§10.11) is full CRUD.

### 8.10 Static/legal pages

`/faq`, `/contact` (`ContactForm.tsx` → `sendContactMessage`, writes a `ContactMessage` row + triggers a `CONTACT_RECEIVED` email), `/privacy`, `/terms`, `/shipping-returns`, `/size-guide`, `/lookbook`, `/drops/[slug]` (a single `Collection`'s landing page). Mostly static copy with a handful of dynamic bits (payment methods list, preorder policy text) kept in sync with actual behavior.

### 8.11 Chat bubble (every storefront page)

`ChatBubble.tsx`, rendered once in `(storefront)/layout.tsx` alongside `CartDrawer`, so it's present on every page without each page needing to think about it. A fixed bottom-right button that expands to WhatsApp/Messenger links, backed by the `chat_widget` `StoreSetting` (§5.5, configured at `/admin/settings` → Chat, §10.13).

The component itself is purely presentational — it receives two already-built URLs (`whatsappUrl`/`messengerUrl`, either possibly `null`) as props and renders nothing at all if both are `null`. All the logic of whether to show it lives in the Server Component layout: it reads `chat_widget`, and only builds a URL when `enabled` is true *and* that channel's field is non-empty — so an admin can offer just one channel by leaving the other blank, and the widget disappears entirely if disabled or unconfigured, rather than rendering dead buttons. The WhatsApp number is digit-stripped (`replace(/[^0-9]/g, "")`) before being placed in the `wa.me/<number>` URL, so it tolerates whatever punctuation an admin types (`+880 1XXX-XXXXXX`, etc.); the prefilled message is URL-encoded into `?text=`. The Messenger link is `m.me/<username-or-id>`, exactly as entered. Both links are plain `<a target="_blank" rel="noopener noreferrer">` — no Facebook/Meta SDK, no page-access-token, nothing that could leak into client bundle; that also means there's no unread-count or in-page chat *widget* in the Meta sense, just a fast path to the real WhatsApp/Messenger apps.

---

## 9. Cart & checkout — full lifecycle

This is the most heavily-audited, most heavily-tested code path in the app (see §19), so it's worth walking end to end.

### 9.1 Before checkout: price derivation

Every price the customer has seen up to this point — on a card, on the PDP, in the cart — came from `deriveProductDisplay()`. Checkout **does not trust any of those client-side numbers.** `placeOrder()` (`src/actions/checkout.ts`) re-fetches every variant server-side by ID, re-derives the active campaign/sale price itself, and computes `unitPrice`/`lineTotal` fresh. The only things trusted from the client are `variantId` and `qty` (both zod-validated: non-empty string, positive integer) — this closes the classic price-tampering hole where a client could submit an arbitrary `unitPrice`.

### 9.2 The checkout form (`CheckoutView.tsx`)

A 4–6 step single-page form (contact → shipping address → shipping method → **preorder advance, only if the cart has a preorder item — informational, not a choice, see §9.6** → payment method → **mixed-cart ship-mode, only if the cart mixes preorder and in-stock items**), driving one `placeOrder()` call on submit. Field-level validation happens client-side first (`validate()`) purely for UX; the server re-validates everything with the same rules via `zod`.

The **available payment methods list is computed reactively** from store settings (`payment_gateways`) and cart contents: COD is excluded whenever *any* preorder line in the cart has a nonzero admin-set advance (§9.6) — if every preorder line is configured free-to-reserve (৳0 advance), COD stays available, same as an ordinary in-stock order. Further gated by the `codRule` setting (inside-Dhaka-only vs. nationwide) against the selected shipping zone.

### 9.3 The order-creation transaction

Everything inside `db.$transaction()` in `placeOrder()`:

1. **Guarded stock decrement.** For each non-preorder line: `tx.variant.updateMany({ where: { id, stockQty: { gte: qty } }, data: { stockQty: { decrement: qty } } })`. If the row count comes back 0, the stock vanished between the earlier read-time check and now (another concurrent checkout won the race) — the transaction throws a `CheckoutConflictError`, rolls back everything, and the customer sees "Not enough stock left... update your bag and try again." This single `WHERE ... AND stockQty >= qty` guard is what makes two simultaneous checkouts for the last unit of stock **impossible to both succeed** — verified with a real concurrent-browser test (§19).
2. **Guarded discount redemption**, same pattern: if the code has a `usageLimit`, the increment is `updateMany({ where: { code, usedCount: { lt: usageLimit } } })` — the last redemption slot can't be double-spent by two simultaneous checkouts either.
3. **Order + OrderItem creation**, with the fully server-derived totals.
4. **Abandoned-checkout cleanup** — any `AbandonedCheckout` row for this email is deleted (the checkout just completed, so it's no longer "abandoned").

### 9.4 Order numbers

`src/lib/order-number.ts` generates `IC-YYYYMMDD-NNNNNN` (a 6-digit random suffix — 900,000 values per day). `Order.number` is `@unique`, so a collision is *possible*, just rare. `placeOrder()` doesn't rely on rarity alone: it retries the whole transaction with a freshly generated number, up to 5 times, specifically when the failure is a Prisma unique-constraint violation (`P2002`) targeting the `number` column — anything else fails immediately rather than retrying blindly.

### 9.5 Money, precision, and the "never charge silently" rule

All checkout arithmetic is plain JS `number`, rounded to 2 decimals (`Math.round(x * 100) / 100`) after every single arithmetic step — subtotal, each discount calculation, the final total, the advance amount, the balance. Storage is `Decimal(10,2)` at the Postgres layer regardless. If anything goes wrong after the transaction opens — a stock conflict, a discount conflict, an order-number collision that exhausts all 5 retries, an unexpected DB error — the customer gets an explicit **"you have not been charged"** in the error message. This is accurate specifically because of how payment is sequenced: for a mocked/COD order nothing is charged before the transaction commits; for a real gateway order (§9.7) the order row is created *first*, then the gateway session — so a failure past that point triggers `restockAndCancelOrder()` (§9.7) rather than leaving a paid-but-broken order.

### 9.6 Preorders — the admin-set-advance philosophy

A variant is a preorder **the moment it's out of stock and the admin has configured an advance for it** — `variantPreorderEligible()` in `product-view.ts`: `stockQty <= 0 && preorderAdvanceAmount != null`. This is the *only* rule; it applies uniformly whether the variant belongs to a genuinely pre-launch product (every size starts at 0 stock, tagged `PREORDER` for the ship-date banner, §2.3) or an ordinary product where one size just sold out. There is no customer choice involved — the advance owed per unit is whatever the admin typed into the "Preorder ৳" column of that variant's row in the product editor (§10.3), set per size/color at insertion or any time after. `0` is a valid, meaningful value: free to reserve, everything collected on delivery. Leaving the field blank (`null`) means the variant just shows "Out of stock" / "Notify me" as before — nothing preorder-shaped happens automatically.

**On the storefront**, `AddToCartForm.tsx` re-derives this per *currently selected* size/color, not once for the whole product: picking a sold-out size that has an advance configured swaps the Add-to-cart button to "Preorder" (yellow), disables nothing, and shows a banner — the product's own ship date if it's tag-based and one was set, otherwise the standard "ships in 7–15 days · Free delivery" copy — plus a price line spelling out the per-unit split ("pay ৳X now, ৳Y on delivery", or "pay ৳0 now — reserve it" when the advance is 0). A size with no admin-configured advance stays disabled/struck-through exactly as before. `ProductCard.tsx` mirrors this at the product level: a product that's *fully* sold out with every remaining variant preorder-configured shows a "Preorder" tag and overlay instead of "Sold out" (`hasPreorderableVariant` on `ProductDisplay`).

**At checkout**, `placeOrder()` recomputes everything server-side from a fresh `Variant` read — never trusts the cart's `isPreorder`/`preorderAdvanceAmount` claims. For each preorder line, `preorderHoldback += (unitPrice − advancePerUnit) × qty` — the only part of the order that can ever be deferred to COD. Everything else (shipping, any discount, every non-preorder line) is always part of what's paid now:

- `advanceAmount = paymentMethod === "COD" ? 0 : total − preorderHoldback`. Forcing it to 0 for COD matters: nothing is ever actually captured through a gateway on that path, so the stored "advance" has to say so, whatever the per-line math would otherwise suggest — the whole order becomes due on delivery.
- `balanceDue = total − advanceAmount`.
- **COD is only available when every preorder line's advance is 0** (`allPreorderLinesFree` in `CheckoutView.tsx`, mirrored server-side as `anyMandatoryPreorderAdvance`) — otherwise bKash/SSLCommerz is required for the (nonzero) advance, the same "COD can't fund a partial online capture" reasoning as before, just scoped per-line instead of per-cart.
- The **advance** (however it was computed) is what's actually sent to the payment gateway — never the full `total` when there's a holdback.
- The **balance**, if any, is collected as cash on delivery; admins mark it collected from the order-detail page's **"Mark COD balance collected"** button (`markBalanceCollected` in `admin-orders.ts`, sets `Order.balanceCollected` — this closes what was previously a documented-but-missing gap).
- Order `status` becomes `PAID` once the *advance* is captured (`0` counts — a free-to-reserve order still needs COD's normal `PENDING` → fulfillment path, same as any other COD order) — the fulfillment pipeline doesn't wait for the balance; only the receipt/order-detail/SMS/email surface the outstanding balance.
- `OrderItem.preorderAdvanceAmount` snapshots the per-unit advance at purchase time (same reasoning as `productTitleSnapshot` — the variant's own value can change later without rewriting history), letting the receipt show a per-item "(advance ৳X/unit)" breakdown, not just an order-level total.

SMS (§13a) and the order-confirmation email both read `advanceAmount`/`balanceDue` straight off the `Order` row, so they're correct by construction once the row is — no separate preorder-aware branching needed beyond the wording (§13a's `classifyOrderSmsType` puts every preorder, including ৳0-advance ones, into its own message type rather than lumping a free-to-reserve preorder in with plain COD, since the reservation framing and longer wait are real differences worth saying).

### 9.7 Real payment gateways, and the mock fallback

`bkashConfigured()` / `sslcommerzConfigured()` (`src/lib/payments/{bkash,sslcommerz}.ts`) just check whether the relevant env vars are set. This single boolean, computed per payment method at the top of `placeOrder()`, branches the entire rest of the function:

**Gateway not configured (default, zero external credentials needed):** the order is created with `status: "PAID"` immediately (or `"PENDING"` for COD) — this is the original, always-worked mocked behavior, completely unchanged by the payment integration work. The customer goes straight to `/order/[number]`.

**Gateway configured:** the order is created with `status: "PENDING"` first (stock is still decremented immediately — the stock hold happens at order-creation regardless of payment method, so overselling protection is unconditional). *After* the transaction commits, `placeOrder()` calls out to the gateway:

- **bKash** (`createBkashPayment`): grants an auth token (cached ~55 min), calls bKash's Tokenized Checkout "create payment" endpoint with the advance amount and a callback URL, gets back a `bkashURL` + `paymentID`. The `paymentID` is immediately saved onto the order (`paymentTransactionId`) so the callback can look the order back up. `placeOrder()` returns `{ ok: true, orderNumber, redirectUrl: bkashURL }`; the client does a full-page `window.location.href` redirect (not a `router.push` — this has to leave the Next.js app).
- **SSLCommerz** (`initSslcommerzSession`): posts store credentials + amount + customer info + three callback URLs (success/fail/cancel) to SSLCommerz's session API, gets back a `GatewayPageURL`, redirects the same way. The `tran_id` sent to SSLCommerz *is* the order number, so its callbacks can look the order up directly with no extra token to track.
- If gateway-session creation itself throws (network error, bad credentials), `restockAndCancelOrder()` (`src/lib/payments/rollback.ts`) runs immediately: restocks every non-preorder variant, decrements the discount's `usedCount` back down if one was applied, marks the order `CANCELLED`/`FAILED` — and the customer sees a clean error, never an oversold or orphaned order.

**The callback routes** (`src/app/api/payments/bkash/callback`, `.../sslcommerz/{success,fail,cancel}`) are where the loop closes:
- bKash: GET with `?paymentID=&status=`. On `status=success`, calls `executeBkashPayment()` to actually finalize the charge server-side (bKash's flow is create-then-execute, two separate calls); on any other status, or if execute fails, `restockAndCancelOrder()` runs and the customer bounces back to `/checkout?payment=failed` (or `cancelled`). `CheckoutView.tsx` reads that `?payment=` query param on mount and shows a matching banner, telling the customer their bag was restored.
- SSLCommerz: POST (form-encoded) to `/success`, `/fail`, or `/cancel` depending on what happened at the gateway. `/success` validates the `val_id` server-to-server (`validateSslcommerzTransaction`) before trusting it — never trusts the browser redirect alone. `/fail` and `/cancel` both just look the order up by `tran_id` and roll it back.
- On success, either callback marks `paymentStatus: "PAID"`, `status: "PAID"`, sends the order-confirmed email, and redirects to `/order/[number]`.

### 9.8 The receipt

`src/app/admin/(receipt)/orders/[id]/receipt/page.tsx` — deliberately in its **own route group**, outside `(dashboard)`, so it renders with zero admin sidebar/topbar chrome (a receipt page with a sidebar next to it would look broken both on screen and if printed). Session-gated by its own minimal layout (`(receipt)/layout.tsx`), not the dashboard's. Styled **light** (`bg-paper`) against the rest of the admin's dark theme — the one deliberate visual inversion called out in §2.1. Shows: brand header (uploaded logo or drawn Monogram+Wordmark, store info from `store_info` settings), order number/date/status, billed-to/ship-to, itemized products, subtotal/coupon-line/shipping/total, a tax note (from `tax_settings`), tracking info if shipped, and a print button (`ReceiptToolbar`, `window.print()`, hidden itself via `print:hidden` when actually printing).

---

## 10. Admin panel walkthrough

Every page lives under `src/app/admin/(dashboard)/`, wrapped by `(dashboard)/layout.tsx` which enforces an admin session (redirects to `/admin/login` otherwise) and renders `AdminSidebar` + `AdminTopbar`. The sidebar (`AdminSidebar.tsx`) is the map of every section, grouped exactly as: **Overview** (Dashboard) · **Sell** (Orders, Products, Inventory, Finance, Categories) · **Grow** (Customers, Discounts, Campaigns, Content CMS, Journal, Analytics, Reviews) · **System** (Emails, Settings).

### 10.1 Dashboard (`/admin/dashboard`)

4 KPI tiles (today's revenue + delta vs. yesterday, today's order count, average order value, low-stock count — `Kpi.tsx`), a 7-day revenue bar chart (pure CSS bars, no charting library), a recent-orders table, a low-stock list. All computed live from `db.order`/`db.variant` aggregates on every page load — no caching layer.

### 10.2 Orders (`/admin/orders`, `/admin/orders/[id]`)

List page: filterable by status/payment method, searchable by order number or email. **Every cell in every row is a link** to the order detail page (a deliberate mobile/desktop-parity fix — see §18). Detail page: itemized order, `OrderActions.tsx` (mark processing/shipped/delivered, refund with confirmation, internal notes), customer info + link to their CRM record, `OrderTimeline`, and a link out to the printable receipt (§9.8).

`refundOrder()` (`src/actions/admin-orders.ts`) is itself race-guarded: it atomically claims the `REFUNDED` transition (`updateMany({ where: { status: { not: "REFUNDED" } } })`) before restocking, so two admins double-clicking refund can't double-restock the same order.

### 10.3 Products (`/admin/products`, `/admin/products/[id]`, `/admin/products/new`)

`ProductEditorForm.tsx` — the biggest form in the app. Basics (title/description/image upload dropzone), variant table (SKU/size/color/hex/stock/low-threshold/price-override/**preorder ৳** — **stock is only editable here for brand-new variant rows**; editing an existing variant's stock through this form is disabled by design, because the form loads stock at page-open time and a sale between then and save would silently clobber a live number — stock changes for existing variants go through Inventory, §10.4 instead), Organize (gender/category/collections/base price/**free-delivery dropdown**), Tags (New/Preorder+ship-date/Limited/Bestseller), Status & SEO. The **Preorder ৳** column is per size/color (blank = not preorder-eligible once sold out, 0 = free to reserve) — this is the actual preorder-purchasability control (§9.6); the Tags panel's Preorder checkbox is purely the ship-date-banner/marketing flag now, not a gate on whether the item can be bought.

Image upload: drag-and-drop or click-to-browse, up to 20 images per product, 12 per request, 8MB per file, 40MB per request total, SVG rejected outright (stored-XSS risk — an uploaded SVG can embed `<script>` and would be served back from its own URL). Files land on local disk at `public/uploads/products/<productId>/<uuid>.<ext>` (§12) and become `ProductImage` rows.

### 10.4 Inventory (`/admin/inventory`)

A flat table of every variant across every product, filterable by SKU search and a "low stock" toggle. Each row's stock is a `StockCell.tsx` — an inline number input with a "Save" button that only appears once the value's actually been changed, calling `setVariantStock()`. This is the **only** place stock is meant to be edited for an existing variant (see §10.3's note on why the product editor deliberately can't). `setVariantStock` is also where the wishlist/back-in-stock notification emails fire (§13.2).

### 10.4a Finance (`/admin/finance`)

The inventory finance ledger (§5.5) — separate from Inventory's live stock-count edits (§10.4). `src/actions/admin-finance.ts`: `createStockOwner()` (name/contact/notes) and `recordStockPurchase()` (owner, variant, quantity, unit cost, supplier, date, notes) — the latter, inside one `$transaction`, both creates the `StockPurchase` row (with the `OrderItem`-style title/variant snapshot) and increments `Variant.stockQty` by the purchased quantity, making this the accountable way stock goes up (vs. `setVariantStock`'s manual correction).

The page itself (`(dashboard)/finance/page.tsx`) does its aggregation the same way `/admin/analytics` does (§10.10) — plain `db` queries and in-memory reduction in the Server Component, no separate query layer:

- **Weighted-average unit cost per variant**, from every `StockPurchase` on record for it (`Σ totalCost / Σ quantity`) — the chosen costing method; FIFO/LIFO lot-tracking was explicitly out of scope.
- **Revenue** — `Σ Order.total` over `paymentStatus: "PAID"` orders.
- **COGS** — `Σ (qty × that variant's avg unit cost)` per sold `OrderItem`, summed across every paid order's items.
- **Gross profit / margin** — `revenue − COGS`, and that as a percent of revenue.
- **Capital by owner** — `Σ StockPurchase.totalCost` grouped by `ownerId`, each owner's share of the all-time total, and that share applied to gross profit as a proportional profit split.
- **Current inventory value at cost** — `Σ (remaining stockQty × avg unit cost)` across variants.

A sold or in-stock unit whose variant has **no** purchase history has no known cost basis — rather than silently treating that as zero-cost (which would overstate profit), those units are excluded from COGS/inventory-value and the page surfaces an explicit count of how many, in-panel.

### 10.5 Categories (`/admin/categories`)

Wraps `CollectionManager.tsx` (CRUD for `Collection` — the "drops" — title/slug/description/hero-copy/active toggle) alongside category management. Categories themselves are the fixed 8 from `src/lib/categories.ts`, reorderable but not freely creatable through this UI today.

### 10.6 Customers (`/admin/customers`, `/admin/customers/[id]`)

List with search; detail page shows the customer's order history, segment tags, and profile info — read-mostly CRM, no bulk actions.

### 10.7 Discounts (`/admin/discounts`)

`DiscountManager.tsx` — full CRUD for coupon codes: code (auto-uppercased on save), type (percent/fixed/free-shipping), value, min spend, usage limit, first-order-only toggle, active toggle. Usage is shown live (`usedCount / usageLimit`). Save errors (duplicate code, validation failure) surface inline rather than crashing — `saveDiscount()` returns `{ok, error}` rather than throwing.

### 10.8 Campaigns (`/admin/campaigns`)

`CampaignManager.tsx` — CRUD for automatic sales (§5.4): name, percent off, target (all categories, one category, or — per the schema — specific products, though the current form only exposes category targeting), start/end datetime, active toggle. This same page also hosts `AbandonedCheckoutPanel.tsx` — the list of captured-but-incomplete checkouts, with per-row and "send all pending" reminder-email buttons (only rows older than 1 hour are eligible for the bulk send, a rough proxy for "genuinely abandoned" vs. "still actively checking out").

### 10.9 Content CMS (`/admin/content`)

`ContentCmsView.tsx` — see §11, its own section given how much it covers.

### 10.10 Analytics (`/admin/analytics`)

Read-only aggregate views (top sellers, revenue trends) — simplest of the admin sections, no CRUD.

### 10.11 Journal (`/admin/journal`, `/admin/journal/[id]`, `/admin/journal/new`)

Full CRUD for `Post` via `PostEditorForm.tsx` and `admin-posts.ts` — same publish-once-stamps-`publishedAt` pattern as products.

### 10.12 Reviews (`/admin/reviews`)

`ReviewRow.tsx` per pending/approved/rejected review — approve/reject/reply, reading `setReviewStatus`/`replyToReview` (`admin-reviews.ts`). No moderation queue prioritization beyond a flat list.

### 10.13 Settings (`/admin/settings`)

`SettingsView.tsx` — a tabbed single component covering everything in `StoreSetting`: **Payments** (which gateways are enabled + COD rule), **Shipping** (per-zone label/cost/ETA for all 3 zones), **Tax** (inclusive toggle, rate, label — informational only, see the code comment: Bangladesh apparel pricing is typically tax-inclusive, so this doesn't add a separate line at checkout unless switched to exclusive), **Emails** (per-type enable toggle + subject line, for all 7 `EmailType`s), **Roles** (embeds `StaffManager.tsx` — invite/remove staff, change role, with guards: an admin can't demote or remove *themselves*, and the last remaining `ADMIN` can't be removed by anyone), **Security** (embeds `TwoFactorSetup.tsx` — per-account TOTP 2FA setup/disable, §7.5; the `findMany` backing the Roles tab now explicitly `select`s only non-sensitive `AdminUser` columns, precisely so `twoFactorSecret`/`passwordHash` are never serialized into that client component's props), **Chat** (the `chat_widget` `StoreSetting` — on/off toggle, WhatsApp number, WhatsApp prefilled message, Messenger page username/ID; see §8.11 for the storefront-facing bubble), **Store** (name/email/phone/address — used in the receipt and in emails).

### 10.14 Emails (`/admin/emails`)

A read-only view of the `EmailLog` table — the outbox. Every email the app has ever "sent," whether or not a real provider delivered it.

### 10.15 SMS (`/admin/sms`)

Same shape as Emails, one level down: a read-only, filterable (by type/recipient) view of `SmsLog` — every order-confirmation text the app has ever "sent" (§13a), whether or not SSL Wireless actually delivered it.

---

## 11. The homepage CMS

`/admin/content` (`ContentCmsView.tsx`, backed by `src/actions/admin-content.ts`), all reading/writing the single `home_hero` `ContentBlock`:

- **Brand identity panel**: logo image upload (falls back to the drawn Monogram+Wordmark when unset — rendered by `Header.tsx`/`Footer.tsx`, which both accept `logoImageUrl`/`brandName` as props sourced from this same block, fetched once in `(storefront)/layout.tsx`), brand name text, motto text (rendered in the footer, replacing what used to be a hardcoded "Stay Inverted").
- **Homepage hero panel**: eyebrow/headline/sub/subBold/badge text fields (all rendered on `/`'s hero — note: earlier in this project's history the `headline` field existed in this form but the homepage silently ignored it and rendered a hardcoded heading instead; that's since been fixed so the field actually does something), a background-color override (native `<input type="color">`, `null` = default), and an uploadable hero-image carousel (`HeroCarousel.tsx` — auto-rotating every 4.5s with dot navigation when 2+ images exist; falls back to the styled placeholder graphic when empty).
- **Featured drop panel**: picks which product renders in the homepage's "Featured drop" section (writes the separate `home_featured_drop` block).

Both logo and hero images upload through the same local-disk pattern as product images (§12), just under `public/uploads/site/{logo,hero}/` instead of `.../products/<id>/`.

---

## 12. Image handling

Every uploaded image in this app — product photos, the site logo, hero carousel images — goes through the same shape: an admin-only server action validates the file (type allow-list minus SVG, size caps, count caps), writes it to `public/uploads/.../<random-uuid>.<ext>` via `node:fs/promises`, and creates a database row pointing at the resulting `/uploads/...` URL. The filename is always a fresh UUID, never derived from the uploaded filename or any user input — so there's no path-traversal surface (the extension is sanitized to `[a-z0-9]` only, defaulting to `jpg`).

This is **local disk storage**, which is exactly right for a single persistent server/VPS with a stable filesystem and exactly wrong for:
- Serverless/ephemeral-disk deploys (e.g. plain Vercel) — files written during a request don't persist to the next one.
- Multiple app instances behind a load balancer without a shared volume — an upload landing on instance A won't be visible from instance B.

Swapping to S3/Cloudinary/etc. before deploying to either of those targets would mean replacing the `fs.writeFile`/`fs.unlink` calls in `admin-products.ts` and `admin-content.ts` with an object-store SDK call, and switching the stored `url` from a local path to whatever the store returns — the rest of the app (everything that reads `ProductImage.url` or `HeroData.logoImageUrl`/`heroImages`) doesn't care where the URL points, so this is a contained, single-layer swap.

---

## 13. Email system

`src/lib/mail.ts`'s `sendMail()` is the one function every email-triggering call site uses. It always, unconditionally, writes an `EmailLog` row first — this is the outbox, visible at `/admin/emails`, and it's the ground truth for "did this email fire" regardless of whether real delivery is configured. If `emailProviderConfigured()` (`src/lib/email-provider.ts` — checks `RESEND_API_KEY` + `EMAIL_FROM`) is true, it *also* calls Resend's plain REST API (`POST https://api.resend.com/emails`) to actually deliver it; a real-send failure is caught and logged, never thrown back up (an email provider hiccup should never crash the checkout/inventory/etc. flow that triggered it — every call site also wraps its own `sendMail()` call in `.catch()`).

Every `EmailType` and its exact trigger:

| Type | Fired from | When |
|---|---|---|
| `WELCOME` | `newsletter.ts` | New newsletter signup |
| `ORDER_CONFIRMED` | `checkout.ts`, both payment callback routes | Order successfully placed/paid |
| `ORDER_SHIPPED` | `admin-orders.ts` (`markOrderShipped`) | Admin marks an order shipped |
| `BACK_IN_STOCK` | `admin-inventory.ts` (`setVariantStock`) | A variant's stock goes 0 → positive — sent to both explicit `BackInStockSubscription` rows *and* customers who wishlisted the product (deduplicated against each other; wishlist notification resets when the product goes back to fully sold-out, so a later restock re-fires it) |
| `PREORDER_SHIP_UPDATE` | `admin-products.ts` (`saveProduct`) | A preorder product's ship date changes, to every customer with an active order containing it |
| `ABANDONED_CHECKOUT` | `admin-marketing.ts` | Admin sends a reminder (single or bulk) for a captured-but-incomplete checkout |
| `CONTACT_RECEIVED` | `contact.ts` | Contact form submission acknowledgement |

Each type can be individually disabled (skipping the outbox write entirely, checked at the top of `sendMail()`) and has an editable subject line, both from Settings → Emails (§10.13).

### 13a. Order-confirmation SMS

Same outbox-first shape as email, in `src/lib/sms.ts`. `sendSms()` always writes an `SmsLog` row (visible at `/admin/sms`, §10.14) and, when `smsProviderConfigured()` (`src/lib/sms-provider.ts` — checks `SSLWIRELESS_SMS_API_TOKEN` + `SSLWIRELESS_SMS_SID`) is true, also POSTs to SSL Wireless's SMS Plus API to actually deliver it — a real-send failure is caught and logged, never thrown, same reasoning as email. Every call site wraps `sendOrderConfirmationSms()` in `.catch()` too, so an SMS-gateway hiccup can never fail an order.

Unlike email, there's no per-type admin toggle or editable copy — SMS content is generated, not templated, because it has to react to which of three mutually-exclusive payment scenarios the order is actually in (`classifyOrderSmsType()`):

| `SmsType` | When | What it says |
|---|---|---|
| `ORDER_CONFIRMED_COD` | `paymentMethod === "COD"` and not a preorder | Order #, items, full total, "pay cash on delivery to `<area>, <district>`" |
| `ORDER_CONFIRMED_PARTIAL` | `isPreorder` (checked first — even a ৳0-advance preorder paid via COD lands here, not in `_COD`, since the reservation framing differs) | Order #, items ("preorder"), advance paid (or "Nothing to pay now — reserved" when the advance is ৳0) — balance due as COD (or "fully paid" when there's none), delivery location |
| `ORDER_CONFIRMED_PAID` | everything else (paid online, nothing outstanding) | Order #, items, total paid in full, shipping location |

`composeOrderConfirmationSms()` builds the message from the order + its items (title/qty, truncated to "first item & N more" beyond two lines) plus `StoreInfo.name`/`.phone` (§5.5) for branding and a help contact. The recipient is `Order.phone` specifically — the checkout form's "Phone (delivery SMS)" field (Step 1, distinct from `shippingPhone`, which is who physically receives the parcel and may be a different person for a gift order) — not `shippingPhone`.

`sendOrderConfirmationSms(orderNumber)` is the one call site every checkout path shares, fired from the same three places `ORDER_CONFIRMED` email fires from: the instant-paid/COD branch of `placeOrder` (`checkout.ts`), and both the bKash and SSLCommerz payment-success callback routes (`api/payments/{bkash,sslcommerz}/...`) — i.e. exactly where an order actually becomes confirmed, not at initial (pending) creation when a live gateway redirect is still in flight.

---

## 14. Payments — summary table

See §9.7 for the full mechanics. Summary of what's real vs. mocked and what's needed to flip each on:

| Method | Real integration | Falls back to | Env vars needed |
|---|---|---|---|
| bKash | Tokenized Checkout API (`src/lib/payments/bkash.ts`) — token grant, create, execute | Instant-paid mock | `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD` |
| Card / mobile banking | SSLCommerz Hosted Checkout (`src/lib/payments/sslcommerz.ts`) — session init, server-side validation | Instant-paid mock | `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD` |
| COD | Always real (there's nothing to integrate — it's cash) | — | — |

Nagad was removed as a payment method entirely (was in the original spec, dropped per a later request) — the enum, every UI reference, and legal-page copy were all updated together, and one demo order that used it was remapped to SSLCommerz in the migration rather than left dangling.

---

## 15. Discounts vs. campaigns — the distinction

Two separate, deliberately non-overlapping discount mechanisms, easy to conflate:

- **`Discount`** (coupon codes) — customer-entered, code-based, validated live at checkout (`/api/discount`) and re-validated server-side inside the order transaction. Can be percent, fixed-amount, or free-shipping. Gated by min-spend, usage limit, first-order-only, active window.
- **`Campaign`** (automatic sales) — no code, always-on for whoever matches the target (category or specific products) during the active window. This is the *only* source of `onSale`/`salePrice` (§2.3) — a `Campaign` is what makes a product show a strikethrough price on a card without the customer doing anything.

They **can stack**: a campaign-discounted price becomes the line's `unitPrice`, and a coupon code discount is then applied against the resulting subtotal — both paths are floor-checked so the total can never go negative (`Math.max(..., 0)` at the relevant step in both `checkout.ts` and `discount.ts`).

---

## 16. Reviews, wishlist, back-in-stock

### 16.1 Review eligibility

`submitReview()` (`src/actions/customer-reviews.ts`) requires: a logged-in customer, an order **number** they own (`customerId` match, not just any order), that order's `status === "DELIVERED"`, and that order actually containing the product being reviewed. A courtesy `findFirst` check blocks an obvious duplicate before insert, but the *real* guard is the database: `@@unique([productId, customerId])` on `Review` (§5.4) — added specifically because a double-submit (double-click, two tabs) could otherwise race past the courtesy check; the insert now fails cleanly on a constraint violation, caught and turned into the same friendly "you've already reviewed this" message rather than a raw error.

### 16.2 Wishlist and back-in-stock — see §13's table for the email mechanics; the data-model side is §5.4.

---

## 17. Mobile responsiveness — the systemic bug and its fix

Worth documenting because it's a recurring CSS pattern that could easily reappear: **`className="grid ... desktop:grid-cols-N"` with no *unprefixed* base column count defaults to an implicit single-column grid track sized to its widest child's max-content width on mobile — not 100% of the viewport.** This silently breaks any two-column-on-desktop layout at mobile widths, because the "single column" isn't actually full-width; it's exactly as wide as whatever it contains, which can force the whole page to scroll horizontally.

This was found by crawling the entire site at 375px width and inspecting which elements actually overflowed, then fixed **everywhere it occurred** (21 files — the homepage hero/collections/featured-drop, the PDP layout, cart, checkout, the account layout, most admin forms and every admin data table) by adding an explicit `grid-cols-1` base before the `desktop:` override. Admin data tables additionally got wrapped in `overflow-x-auto` so a wide table scrolls within its own box instead of blowing out the page. The fix pattern is mechanical and easy to re-apply: any future `grid ... desktop:grid-cols-...` needs a `grid-cols-N` (usually `1`) right after `grid`.

---

## 18. Security posture

A running list of hardening measures, each with the reasoning:

- **`SESSION_SECRET` required in production** (§7.1) — no hardcoded fallback secret reachable at runtime.
- **`DATABASE_URL` validated at startup** (`src/lib/db.ts`) — fails fast and clearly rather than a confusing low-level connection error.
- **Login lockout** (§7.2) on both admin and customer login — the only brute-force guard in the app.
- **Security headers on every response** (§7.4).
- **Image upload hardening** (§12) — SVG rejected, size/count caps, UUID filenames.
- **Checkout race-safety** (§9.3) — guarded atomic updates for stock and discount redemption, not read-then-write.
- **Refund race-safety** (§10.2) — atomic claim on the `REFUNDED` transition.
- **OAuth admin non-self-registration** (§7.3) — the one privilege-escalation path that was explicitly designed against.
- **Price tampering closed** (§9.1) — checkout never trusts a client-supplied price.
- **Admin 2FA secret/backup codes never reach the client** (§7.5, §10.13) — `TwoFactorSetup.tsx` only ever receives a boolean `enabled` prop from the server; the secret and hashed backup codes stay server-side, read only inside the `"use server"` actions in `admin-2fa.ts`.
- **TOTP built from the RFC, not a dependency** (§7.5) — verified against RFC 6238's official Appendix B test vector before being wired into login.
- **Seed-script production guard** (`prisma/seed.ts`) — refuses to run against `NODE_ENV=production` unless explicitly opted into with `ALLOW_PRODUCTION_SEED=true`, because it creates demo accounts with passwords published in this repo's README.
- **Graceful error handling** on public-facing mutations (contact, newsletter, discount save, product delete) — wrapped so a transient DB error or a double-submit returns a clean `{ok:false}` instead of crashing to a raw error page.

---

## 19. How confidence in all of this was established

Every non-trivial claim in this document — the stock-race guard actually preventing overselling, the OAuth not-configured bounce actually working, the free-delivery tag actually rendering after being set, the mobile grid fix actually eliminating overflow — was verified with a real headless-browser test (Playwright) against a real running instance of the app with a real Postgres database, not just read out of the code. The recurring pattern used throughout this project's build: make the change, write a small throwaway script that drives the actual UI (or, for concurrency claims, drives *two* browser contexts simultaneously) to the exact scenario being claimed, run it, read the real result, clean up any test data it created, then move on. The concurrent-checkout overselling test in particular has been re-run more than once, including after the payment-gateway integration substantially rewrote `checkout.ts`, specifically because it's the single highest-consequence correctness claim in the app.

---

## 20. Known limitations / what's still mocked

- **Local-disk image storage** doesn't survive serverless/ephemeral deploys or multi-instance setups without a shared volume (§12).
- **Payments, real email, real SMS, and OAuth** all need externally-provisioned credentials to go live — see §14, §13, §13a, §7.3, and the table in `README.md`'s "Going live" section for exactly which env vars.
- **Order-confirmation SMS has no per-type admin toggle** the way email does (§13a) — it's always on if SSL Wireless is configured, since it's a single generated message rather than an editable template.
- **Free-delivery tag is presentational only** — it doesn't currently zero out the shipping line at checkout.
- **No per-variant ship-date for auto-preorder-on-stockout items** — only tag-based (pre-launch) preorders carry a ship date; a size that sold out and became preorder-eligible mid-life just shows the generic "7–15 days" window, not a specific date.
- **OAuth account linking is by email match** — a Google account with a different email than an existing password account creates a second, separate customer record rather than prompting a merge.
- **No session revocation** beyond cookie expiry or rotating `SESSION_SECRET` (§7.1).
- **Abandoned-checkout reminders are admin-triggered**, not on an automatic schedule (`sendAllAbandonedReminders` would need a cron job wired to it for real automation).
- **Tax is informational only** unless switched from inclusive to exclusive pricing.
- **No CSP** (security headers stop short of one — §7.4).
- **Inventory costing is weighted-average only** (§10.4a) — no FIFO/LIFO lot tracking; a sold/in-stock unit with no recorded `StockPurchase` history has no cost basis and is explicitly excluded from COGS/inventory-value rather than assumed to be zero-cost.
- **2FA has no recovery path beyond backup codes** — if an admin loses both their authenticator app and their backup codes, another `ADMIN` must disable 2FA for them via direct database access (there's no admin-to-admin "reset this user's 2FA" UI today).

---

## 21. Environment variables — full reference

| Variable | Required? | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string |
| `SESSION_SECRET` | Yes in production | JWT signing key for both session cookies |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | No (seed only) | Seed script's admin account credentials |
| `ALLOW_PRODUCTION_SEED` | No | Must be `true` to let the seed script run when `NODE_ENV=production` |
| `SITE_URL` | Recommended in production | Base URL for payment/OAuth callback links; derived from request headers if unset |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | No | Google OAuth |
| `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | No | Facebook OAuth |
| `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_USERNAME`, `BKASH_PASSWORD`, `BKASH_BASE_URL` | No | Real bKash payments (base URL defaults to bKash's sandbox) |
| `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, `SSLCOMMERZ_SANDBOX` | No | Real card/mobile-banking payments |
| `RESEND_API_KEY`, `EMAIL_FROM` | No | Real email delivery |
| `SSLWIRELESS_SMS_API_TOKEN`, `SSLWIRELESS_SMS_SID`, `SSLWIRELESS_SMS_BASE_URL` | No | Real order-confirmation SMS delivery (base URL defaults to SSL Wireless's SMS Plus host) |

Full annotated template: `.env.example`.

---

## 22. File-relationship quick reference

For "what touches what" at a glance:

- **A price appears anywhere** → traces back to `deriveProductDisplay()` in `product-view.ts`, or — at checkout specifically — to the same campaign logic re-run server-side in `checkout.ts`.
- **An order is created** → `checkout.ts` → decrements `Variant.stockQty`, increments `Discount.usedCount`, deletes any matching `AbandonedCheckout`, creates `Order`+`OrderItem`, optionally calls out to `lib/payments/*`. Once it's actually confirmed (immediately for instant-paid/COD, or from the payment callback route once a live gateway redirect resolves) it calls `sendMail()` → writes `EmailLog` (+ real Resend call if configured) and `sendOrderConfirmationSms()` → writes `SmsLog` (+ real SSL Wireless call if configured), §13a.
- **Stock changes** → `admin-inventory.ts`'s `setVariantStock` (manual correction, also fires back-in-stock/wishlist emails), `checkout.ts`'s guarded decrement (a sale), `admin-orders.ts`'s `refundOrder` (a restock), or `admin-finance.ts`'s `recordStockPurchase` (an accountable increase, alongside a `StockPurchase` row — §10.4a).
- **A product is saved** → `admin-products.ts`'s `saveProduct` → touches `Product`, `Variant` (upsert/delete), `ProductCollection` (replace), `ProductTag` (replace), and conditionally emails everyone with an active preorder order for it if the ship date changed.
- **An image is uploaded** (product or site) → writes to `public/uploads/...` and a `ProductImage` row or the `home_hero` `ContentBlock`'s `logoImageUrl`/`heroImages` array — same validation/storage pattern either way (`§12`).
- **The homepage renders** → `(storefront)/layout.tsx` and `(storefront)/page.tsx` both independently read the same `home_hero` `ContentBlock` (layout for Header/Footer branding, page for the hero itself) — editing it in `/admin/content` invalidates both via `revalidatePath("/")`.
- **A login happens** (any of email/password, Google, Facebook — customer or admin) → always ends at `setCustomerSession()`/`setAdminSession()` in `session.ts`, the one place either cookie is ever written — except an admin with 2FA enabled, which detours through `setAdmin2FAPending()` and a second `verifyAdminTwoFactor()` step first (§7.5).
