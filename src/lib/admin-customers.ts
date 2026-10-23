import "server-only";
import { db } from "@/lib/db";
import { parseSearchAmount, parseSearchDateRange } from "@/lib/admin-search";
import { distinctPhones, distinctShipTo, type ShipTo } from "@/lib/customer-orders";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The Customers section lists *people*, whether or not they have an account:
 *  - REGISTERED: a Customer row, with every order linked to it — plus any order placed with the
 *    same email while logged out (those stay unlinked in the database, so they're pulled in here
 *    and tagged "guest checkout");
 *  - GUEST: someone who only ever checked out as a guest. There's no row for them — they are
 *    grouped from their orders by email address (case-insensitively), and their personal details
 *    are what they typed at checkout.
 */
export const MAX_PEOPLE = 100;
/** Guests are grouped from their most recent orders; this bounds the work on a very large store. */
const GUEST_ORDER_POOL = 2000;
const MAX_SEARCH_WORDS = 8;

export const LIST_ORDER_SELECT = {
  id: true,
  number: true,
  email: true,
  phone: true,
  status: true,
  total: true,
  createdAt: true,
  paymentMethod: true,
  paymentStatus: true,
  isPreorder: true,
  cancellationRequestedAt: true,
  customerId: true,
  shippingFullName: true,
  shippingPhone: true,
  shippingLine1: true,
  shippingArea: true,
  shippingDistrict: true,
  shippingPostcode: true,
  shippingCountry: true,
  items: { select: { id: true, productId: true, productTitleSnapshot: true, variantLabelSnapshot: true, qty: true, lineTotal: true } },
} satisfies Prisma.OrderSelect;
export type ListOrder = Prisma.OrderGetPayload<{ select: typeof LIST_ORDER_SELECT }>;

export type Person = {
  kind: "registered" | "guest";
  key: string;
  href: string;
  name: string | null;
  email: string;
  phones: string[];
  addresses: (ShipTo & { isDefault?: boolean })[];
  addressesFromOrders: boolean;
  avatarUrl: string | null;
  /** Joined (registered) or first order (guest). */
  since: Date;
  signIn: string[];
  locked: boolean;
  notes: string | null;
  tags: string[];
  wishlistCount: number;
  /** Newest first. */
  orders: ListOrder[];
  lastActivity: Date;
};

// One search word has to match *something* about a person: their own profile, a saved address, or
// anything on an order they placed (including the products in it). Words are ANDed, so
// "rahim dhaka" finds the Rahim whose address or orders mention Dhaka — typing more narrows.
function orderWordCondition(word: string): Prisma.OrderWhereInput {
  const has = { contains: word, mode: "insensitive" as const };
  const any: Prisma.OrderWhereInput[] = [
    { number: has },
    { email: has },
    { phone: has },
    { discountCode: has },
    { trackingRef: has },
    { shippingFullName: has },
    { shippingPhone: has },
    { shippingLine1: has },
    { shippingArea: has },
    { shippingDistrict: has },
    { shippingPostcode: has },
    { items: { some: { productTitleSnapshot: has } } },
  ];
  const amount = parseSearchAmount(word);
  if (amount != null) any.push({ total: amount });
  const day = parseSearchDateRange(word);
  if (day) any.push({ createdAt: day });
  return { OR: any };
}

function customerWordCondition(word: string): Prisma.CustomerWhereInput {
  const has = { contains: word, mode: "insensitive" as const };
  const any: Prisma.CustomerWhereInput[] = [
    { name: has },
    { email: has },
    { phone: has },
    { notes: has },
    { addresses: { some: { OR: [{ fullName: has }, { phone: has }, { line1: has }, { area: has }, { district: has }, { postcode: has }] } } },
    { orders: { some: orderWordCondition(word) } },
  ];
  const day = parseSearchDateRange(word);
  if (day) any.push({ createdAt: day });
  return { OR: any };
}

const words = (q: string) => q.split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_WORDS);

function customerSearchWhere(q: string): Prisma.CustomerWhereInput {
  const w = words(q);
  const alternatives: Prisma.CustomerWhereInput[] = [{ AND: w.map(customerWordCondition) }];
  // A multi-word date ("Oct 14 2026") would be shredded by the word split, so the whole phrase
  // also gets one shot at being a date on its own.
  const phraseDay = w.length > 1 ? parseSearchDateRange(q) : null;
  if (phraseDay) alternatives.push({ createdAt: phraseDay }, { orders: { some: { createdAt: phraseDay } } });
  return { OR: alternatives };
}

function guestOrderSearchWhere(q: string): Prisma.OrderWhereInput {
  const w = words(q);
  const alternatives: Prisma.OrderWhereInput[] = [{ AND: w.map(orderWordCondition) }];
  const phraseDay = w.length > 1 ? parseSearchDateRange(q) : null;
  if (phraseDay) alternatives.push({ createdAt: phraseDay });
  return { OR: alternatives };
}

const lc = (s: string) => s.trim().toLowerCase();
const byNewest = (a: { createdAt: Date }, b: { createdAt: Date }) => b.createdAt.getTime() - a.createdAt.getTime();

export const guestHref = (email: string) => `/admin/customers/guest/${encodeURIComponent(lc(email))}`;

export type PeopleResult = { people: Person[]; registeredTotal: number; guestTotal: number; truncated: boolean };

export async function loadPeople(q: string | undefined, kind: "all" | "registered" | "guest"): Promise<PeopleResult> {
  const wantRegistered = kind !== "guest";
  const wantGuests = kind !== "registered";

  // Every account's email, so a guest group is never one that actually has an account.
  const registeredEmails = new Set((await db.customer.findMany({ select: { email: true } })).map((c) => lc(c.email)));

  // Orders placed while logged out (or by someone with no account), newest first.
  const unlinked = await db.order.findMany({
    where: { customerId: null, source: "ONLINE" }, // a sale recorded by hand is not a guest customer
    select: LIST_ORDER_SELECT,
    orderBy: { createdAt: "desc" },
    take: GUEST_ORDER_POOL,
  });
  const unlinkedByEmail = new Map<string, ListOrder[]>();
  for (const o of unlinked) {
    const k = lc(o.email);
    unlinkedByEmail.set(k, [...(unlinkedByEmail.get(k) ?? []), o]);
  }

  const people: Person[] = [];
  let registeredTotal = 0;
  let guestTotal = 0;

  if (wantRegistered) {
    const where = q ? customerSearchWhere(q) : undefined;
    registeredTotal = await db.customer.count({ where });
    const customers = await db.customer.findMany({
      where,
      include: {
        orders: { select: LIST_ORDER_SELECT, orderBy: { createdAt: "desc" } },
        addresses: { orderBy: { isDefault: "desc" } },
        _count: { select: { wishlist: true } },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_PEOPLE,
    });
    for (const c of customers) {
      const orders = [...c.orders, ...(unlinkedByEmail.get(lc(c.email)) ?? [])].sort(byNewest);
      const saved = c.addresses.map((a) => ({
        fullName: a.fullName,
        phone: a.phone,
        line1: a.line1,
        area: a.area,
        district: a.district,
        postcode: a.postcode,
        country: a.country,
        isDefault: a.isDefault,
      }));
      people.push({
        kind: "registered",
        key: c.id,
        href: `/admin/customers/${c.id}`,
        name: c.name,
        email: c.email,
        phones: distinctPhones([c.phone, ...c.addresses.map((a) => a.phone), ...orders.flatMap((o) => [o.phone, o.shippingPhone])]),
        addresses: saved.length ? saved : distinctShipTo(orders),
        addressesFromOrders: saved.length === 0,
        avatarUrl: c.avatarUrl,
        since: c.createdAt,
        signIn: [c.passwordHash && "Email & password", c.googleId && "Google"].filter(Boolean) as string[],
        locked: c.lockedUntil != null && c.lockedUntil > new Date(),
        notes: c.notes,
        tags: c.segmentTags,
        wishlistCount: c._count.wishlist,
        orders,
        lastActivity: orders[0]?.createdAt ?? c.createdAt,
      });
    }
  }

  if (wantGuests) {
    let matched: Set<string> | null = null;
    if (q) {
      const rows = await db.order.findMany({ where: { AND: [{ customerId: null, source: "ONLINE" }, guestOrderSearchWhere(q)] }, select: { email: true } });
      matched = new Set(rows.map((r) => lc(r.email)));
    }
    const groups = [...unlinkedByEmail.entries()].filter(([email]) => !registeredEmails.has(email) && (!matched || matched.has(email)));
    guestTotal = groups.length;
    for (const [email, orders] of groups) {
      const sorted = [...orders].sort(byNewest);
      const latest = sorted[0];
      people.push({
        kind: "guest",
        key: email,
        href: guestHref(email),
        name: latest.shippingFullName,
        email: latest.email,
        phones: distinctPhones(sorted.flatMap((o) => [o.phone, o.shippingPhone])),
        addresses: distinctShipTo(sorted),
        addressesFromOrders: true,
        avatarUrl: null,
        since: sorted[sorted.length - 1].createdAt,
        signIn: [],
        locked: false,
        notes: null,
        tags: [],
        wishlistCount: 0,
        orders: sorted,
        lastActivity: latest.createdAt,
      });
    }
  }

  people.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
  const truncated = people.length > MAX_PEOPLE || unlinked.length === GUEST_ORDER_POOL;
  return { people: people.slice(0, MAX_PEOPLE), registeredTotal, guestTotal, truncated };
}
