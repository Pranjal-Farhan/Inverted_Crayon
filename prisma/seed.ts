import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { CATEGORIES } from "../src/lib/categories";
import { generateOrderNumber } from "../src/lib/order-number";
import {
  DEFAULT_PAYMENT_GATEWAYS,
  DEFAULT_SHIPPING_RATES,
  DEFAULT_STORE_INFO,
} from "../src/lib/store-settings";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

const COLORS: { name: string; hex: string }[] = [
  { name: "Black", hex: "#0c0c0d" },
  { name: "Washed Grey", hex: "#8f8f93" },
  { name: "Pink", hex: "#ff2d84" },
  { name: "Cyan", hex: "#26a7e6" },
  { name: "Lime", hex: "#c3f53a" },
  { name: "Yellow", hex: "#ffd23b" },
  { name: "Indigo", hex: "#2a3a6b" },
];

const APPAREL_SIZES = ["S", "M", "L", "XL", "XXL"];
const ONE_SIZE = ["One Size"];

// title pool per category — adjectives x noun, gives plenty of variety
const ADJ = [
  "Inverted",
  "Scrawl",
  "Crayon Box",
  "Norm-Breaker",
  "Static",
  "Drip",
  "Outsider",
  "Marker Logo",
  "X-Eyes",
  "Wax Wash",
  "Crown",
  "Not Normal",
];

const NOUN: Record<string, string[]> = {
  shirts: ["Oversize Shirt", "Boxy Shirt", "Flannel Overshirt"],
  tees: ["Oversize Tee", "Graphic Tee", "Long Sleeve Tee"],
  jeans: ["Denim", "Wide Jeans", "Straight Jeans"],
  trousers: ["Cargo Pants", "Track Pants", "Pleated Trousers"],
  hoodies: ["Pullover Hoodie", "Zip Hoodie", "Cropped Hoodie"],
  outerwear: ["Track Jacket", "Bomber Jacket", "Puffer Vest"],
  headwear: ["Snapback", "Bucket Hat", "Beanie"],
  accessories: ["Tote Bag", "Crossbody Bag", "Sock Set"],
};

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("Seeding…");

  // ---------- categories ----------
  const categoryRows = await Promise.all(
    CATEGORIES.map((c, i) =>
      db.category.upsert({
        where: { slug: c.slug },
        update: { name: c.name, position: i },
        create: { slug: c.slug, name: c.name, position: i },
      }),
    ),
  );
  const catBySlug = Object.fromEntries(categoryRows.map((c) => [c.slug, c]));

  // ---------- tags ----------
  const tagDefs = [
    { type: "PREORDER" as const, label: "Preorder" },
    { type: "NEW" as const, label: "New" },
    { type: "LIMITED" as const, label: "Limited" },
    { type: "BESTSELLER" as const, label: "Bestseller" },
  ];
  const tagRows = await Promise.all(
    tagDefs.map((t) =>
      db.tag.upsert({ where: { type: t.type }, update: { label: t.label }, create: t }),
    ),
  );
  const tagByType = Object.fromEntries(tagRows.map((t) => [t.type, t]));

  // ---------- collections ----------
  const dropCollection = await db.collection.upsert({
    where: { slug: "the-outsiders" },
    update: {},
    create: {
      title: "Drop 04 — The Outsiders",
      slug: "the-outsiders",
      description: "A 12-piece capsule for the ones who never fit the box.",
      heroCopy: "Limited runs, numbered, gone when they're gone.",
      active: true,
    },
  });
  await db.collection.upsert({
    where: { slug: "summer-static" },
    update: {},
    create: {
      title: "Summer Static",
      slug: "summer-static",
      description: "Bright noise for the hottest months.",
      active: false,
    },
  });

  // ---------- products ----------
  const genders: Array<"MEN" | "WOMEN" | "UNISEX"> = ["MEN", "WOMEN"];
  let seedCounter = 0;
  const createdProducts: { id: string; categorySlug: string }[] = [];

  for (const category of CATEGORIES) {
    for (const gender of genders) {
      for (let variantIdx = 0; variantIdx < 2; variantIdx++) {
        seedCounter++;
        const adj = pick(ADJ, seedCounter);
        const noun = pick(NOUN[category.slug], seedCounter + variantIdx);
        const title = `${adj} ${noun}`;
        const baseSlug = slugify(`${title}-${gender}`);
        const basePrice = 850 + ((seedCounter * 137) % 24) * 100;

        const isPreorder = seedCounter % 9 === 0;
        const isLimited = seedCounter % 7 === 0;
        const isBestseller = seedCounter % 5 === 0;
        const isNewFlag = seedCounter % 4 === 0;
        const publishedDaysAgo = isNewFlag ? seedCounter % 10 : 40 + (seedCounter % 90);

        const sizes = category.slug === "headwear" || category.slug === "accessories" ? ONE_SIZE : APPAREL_SIZES;
        const colorA = pick(COLORS, seedCounter);
        const colorB = pick(COLORS, seedCounter + 3);
        const colorsForProduct = colorA.name === colorB.name ? [colorA] : [colorA, colorB];

        const product = await db.product.upsert({
          where: { slug: baseSlug },
          update: {},
          create: {
            slug: baseSlug,
            title,
            description:
              "Heavyweight cotton, boxy cut, screen-printed to crack and fade — on purpose. Made to stand out, built to last.",
            gender,
            basePrice,
            status: "ACTIVE",
            categoryId: catBySlug[category.slug].id,
            publishedAt: new Date(Date.now() - publishedDaysAgo * 24 * 60 * 60 * 1000),
            seoTitle: title,
            seoDescription: `${title} — Inverted Crayon streetwear.`,
            images: {
              create: [{ url: "", alt: title, position: 0, accentColor: colorA.hex }],
            },
            variants: {
              create: sizes.flatMap((size, sIdx) =>
                colorsForProduct.map((color, cIdx) => {
                  const stock = (seedCounter + sIdx + cIdx) % 11; // some will be 0 (sold out)
                  return {
                    sku: `${baseSlug.slice(0, 8).toUpperCase()}-${size}-${color.name.slice(0, 3).toUpperCase()}-${sIdx}${cIdx}`,
                    size,
                    color: color.name,
                    colorHex: color.hex,
                    stockQty: isPreorder ? 0 : stock,
                    lowStockThreshold: 5,
                  };
                }),
              ),
            },
          },
        });

        createdProducts.push({ id: product.id, categorySlug: category.slug });

        const tagsToAttach: { type: keyof typeof tagByType; meta?: Record<string, unknown> }[] = [];
        if (isPreorder) tagsToAttach.push({ type: "PREORDER", meta: { shipDate: "15 Oct" } });
        if (isNewFlag) tagsToAttach.push({ type: "NEW" });
        if (isLimited) tagsToAttach.push({ type: "LIMITED" });
        if (isBestseller) tagsToAttach.push({ type: "BESTSELLER" });

        for (const t of tagsToAttach) {
          await db.productTag.upsert({
            where: { productId_tagId: { productId: product.id, tagId: tagByType[t.type].id } },
            update: { meta: (t.meta ?? undefined) as never },
            create: { productId: product.id, tagId: tagByType[t.type].id, meta: (t.meta ?? undefined) as never },
          });
        }

        // put a handful of products into the featured collection
        if (seedCounter % 6 === 0) {
          await db.productCollection.upsert({
            where: { productId_collectionId: { productId: product.id, collectionId: dropCollection.id } },
            update: {},
            create: { productId: product.id, collectionId: dropCollection.id },
          });
        }
      }
    }
  }

  console.log(`Seeded ${createdProducts.length} products.`);

  // ---------- campaign: End-of-season sale on Hoodies ----------
  const hoodiesCat = catBySlug["hoodies"];
  await db.campaign.deleteMany({ where: { name: "End-of-season" } });
  await db.campaign.create({
    data: {
      name: "End-of-season",
      percentOff: 25,
      targetCategoryId: hoodiesCat.id,
      startsAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      active: true,
    },
  });
  await db.campaign.deleteMany({ where: { name: "Eid Drop" } });
  await db.campaign.create({
    data: {
      name: "Eid Drop",
      percentOff: 15,
      targetProductIds: createdProducts.slice(0, 5).map((p) => p.id),
      startsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
      active: true,
    },
  });

  // ---------- discounts ----------
  await db.discount.upsert({
    where: { code: "INVERT10" },
    update: {},
    create: { code: "INVERT10", type: "PERCENT", value: 10, minSpend: 1500, usedCount: 142, active: true },
  });
  await db.discount.upsert({
    where: { code: "FREESHIP" },
    update: {},
    create: { code: "FREESHIP", type: "FREE_SHIPPING", value: 0, minSpend: 3000, usedCount: 67, active: true },
  });
  await db.discount.upsert({
    where: { code: "DROP04" },
    update: {},
    create: {
      code: "DROP04",
      type: "FIXED",
      value: 200,
      usedCount: 0,
      active: true,
      startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
  });

  // ---------- admin users ----------
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@invertedcrayon.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "StandOut123!";
  await db.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      name: "Rex (Admin)",
      role: "ADMIN",
    },
  });
  await db.adminUser.upsert({
    where: { email: "staff@invertedcrayon.com" },
    update: {},
    create: {
      email: "staff@invertedcrayon.com",
      passwordHash: await bcrypt.hash("StaffPass123!", 10),
      name: "Mitu (Staff)",
      role: "STAFF",
    },
  });

  // ---------- customers ----------
  const rex = await db.customer.upsert({
    where: { email: "rex@example.com" },
    update: {},
    create: {
      email: "rex@example.com",
      passwordHash: await bcrypt.hash("Password123!", 10),
      name: "Rex O.",
      phone: "+880 1711-000000",
      segmentTags: ["VIP"],
      addresses: {
        create: {
          fullName: "Rex O.",
          phone: "+880 1711-000000",
          line1: "House 12, Road 4, Dhanmondi",
          area: "Dhanmondi",
          district: "Dhaka",
          postcode: "1209",
          country: "Bangladesh",
          isDefault: true,
        },
      },
    },
  });
  const mitu = await db.customer.upsert({
    where: { email: "mitu@example.com" },
    update: {},
    create: { email: "mitu@example.com", name: "Mitu R.", phone: "+880 1611-111111", segmentTags: ["Repeat"] },
  });
  await db.customer.upsert({
    where: { email: "arif@example.com" },
    update: {},
    create: { email: "arif@example.com", name: "Arif H.", phone: "+880 1511-222222", segmentTags: ["New"] },
  });

  // ---------- sample orders ----------
  const sampleProducts = await db.product.findMany({ take: 6, include: { variants: true } });
  function lineFor(p: (typeof sampleProducts)[number], qty = 1) {
    const v = p.variants[0];
    const unit = Number(v.priceOverride ?? p.basePrice);
    return {
      productId: p.id,
      variantId: v.id,
      productTitleSnapshot: p.title,
      variantLabelSnapshot: `${v.size} / ${v.color}`,
      qty,
      unitPrice: unit,
      lineTotal: unit * qty,
      isPreorder: false,
    };
  }

  const orderDefs: Array<{
    status: "PENDING" | "PAID" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "REFUNDED";
    paymentMethod: "BKASH" | "NAGAD" | "SSLCOMMERZ" | "COD";
    paymentStatus: "PENDING" | "PAID" | "REFUNDED";
    email: string;
    customerId?: string;
    daysAgo: number;
  }> = [
    { status: "PAID", paymentMethod: "BKASH", paymentStatus: "PAID", email: rex.email, customerId: rex.id, daysAgo: 0 },
    { status: "PENDING", paymentMethod: "COD", paymentStatus: "PENDING", email: mitu.email, customerId: mitu.id, daysAgo: 0 },
    { status: "SHIPPED", paymentMethod: "SSLCOMMERZ", paymentStatus: "PAID", email: "arif@example.com", daysAgo: 1 },
    { status: "DELIVERED", paymentMethod: "NAGAD", paymentStatus: "PAID", email: "nabil@example.com", daysAgo: 1 },
    { status: "REFUNDED", paymentMethod: "BKASH", paymentStatus: "REFUNDED", email: "sara@example.com", daysAgo: 2 },
  ];

  for (const [i, def] of orderDefs.entries()) {
    const items = [lineFor(sampleProducts[i % sampleProducts.length]), lineFor(sampleProducts[(i + 1) % sampleProducts.length])];
    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    const shippingCost = 60;
    const total = subtotal + shippingCost;
    await db.order.create({
      data: {
        number: generateOrderNumber(new Date(Date.now() - def.daysAgo * 24 * 60 * 60 * 1000)),
        email: def.email,
        phone: "+880 1XXX-XXXXXX",
        customerId: def.customerId,
        status: def.status,
        subtotal,
        shippingCost,
        total,
        paymentMethod: def.paymentMethod,
        paymentStatus: def.paymentStatus,
        shippingZone: "INSIDE_DHAKA",
        shippingFullName: "Customer Name",
        shippingPhone: "+880 1XXX-XXXXXX",
        shippingLine1: "House 12, Road 4, Dhanmondi",
        shippingArea: "Dhanmondi",
        shippingDistrict: "Dhaka",
        shippingPostcode: "1209",
        createdAt: new Date(Date.now() - def.daysAgo * 24 * 60 * 60 * 1000),
        items: { create: items },
      },
    });
  }

  // ---------- reviews ----------
  for (const p of sampleProducts.slice(0, 4)) {
    await db.review.create({
      data: {
        productId: p.id,
        customerId: rex.id,
        authorName: "Rex O.",
        rating: 5,
        body: "Heavyweight, fits true to size, print held up after washes. Made to stand out, for real.",
        status: "APPROVED",
      },
    });
  }

  // ---------- content blocks ----------
  await db.contentBlock.upsert({
    where: { key: "home_hero" },
    update: {},
    create: {
      key: "home_hero",
      data: {
        eyebrow: "Color outside the norm.",
        headline: "Invert the ordinary.",
        sub: "Streetwear made for disruptors.",
        subBold: "Bold. Unfiltered. Inverted.",
        badge: "New drop live now",
      },
    },
  });
  await db.contentBlock.upsert({
    where: { key: "home_featured_drop" },
    update: {},
    create: { key: "home_featured_drop", data: { productId: sampleProducts[0]?.id ?? null } },
  });

  // ---------- store settings ----------
  await db.storeSetting.upsert({
    where: { key: "shipping_rates" },
    update: {},
    create: { key: "shipping_rates", value: DEFAULT_SHIPPING_RATES },
  });
  await db.storeSetting.upsert({
    where: { key: "payment_gateways" },
    update: {},
    create: { key: "payment_gateways", value: DEFAULT_PAYMENT_GATEWAYS },
  });
  await db.storeSetting.upsert({
    where: { key: "store_info" },
    update: {},
    create: { key: "store_info", value: DEFAULT_STORE_INFO },
  });

  console.log("Seed complete.");
  console.log(`Admin login → ${adminEmail} / ${adminPassword}`);
  console.log(`Customer login → rex@example.com / Password123!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
