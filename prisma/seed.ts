import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateOrderNumber } from "../src/lib/order-number";

// The product page's description is three sections (Mood / Build / How n when to wear);
// `description` mirrors Mood.
const DEMO_MOOD = "Loud on purpose. A heavyweight piece with a boxy, easy cut and graphics that crack and fade like they've already lived a little — made to stand out in a crowd of plain.";
const DEMO_COPY = {
  description: DEMO_MOOD,
  mood: DEMO_MOOD,
  build:
    "- 100% heavyweight cotton, brushed inside\n- Boxy cut with a dropped shoulder — size up for extra room\n- Screen-printed graphics, washed to crack and fade\n- Reinforced seams that hold up wash after wash",
  howToWear:
    "Throw it on over a plain tee for the weekend, or let it carry a whole look on its own.\n\nBest for: late nights out, campus days, studio sessions and cooler evenings.\n\nPair it with straight jeans and chunky sneakers, or cargos and boots.",
};

/** The 8 base category defs — each gets its own Men and Women row (see the categories
 * section in main()). Slugs match the NOUN pool keys below. */
const CATEGORY_DEFS = [
  { slug: "shirts", name: "Shirts" },
  { slug: "tees", name: "Tees" },
  { slug: "jeans", name: "Jeans" },
  { slug: "trousers", name: "Trousers" },
  { slug: "hoodies", name: "Hoodies" },
  { slug: "outerwear", name: "Outerwear" },
  { slug: "headwear", name: "Headwear" },
  { slug: "accessories", name: "Accessories" },
] as const;
import { DEFAULT_STORE_INFO } from "../src/lib/store-settings";

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

const APPAREL_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"];
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
  essentials: ["Crew Socks", "Tote Bag", "Beanie"],
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
  // This script is a demo/dev dataset — it creates test customer accounts with known passwords
  // (e.g. rex@example.com / Password123!) and a demo staff login, published in this repo's README.
  // Never run it unattended against a real production database.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error(
      "Refusing to run the demo seed against a production database (NODE_ENV=production). " +
        "It creates test accounts with publicly-known passwords. If you really want this demo " +
        "catalog as a starting point, set ALLOW_PRODUCTION_SEED=true and re-run.",
    );
  }

  console.log("Seeding…");

  // ---------- categories ----------
  // Every category belongs to one gender branch — Men and Women each get their own row per
  // base def. "essentials" is seeded Unisex-only and then mirrored into Men/Women, the same
  // way admin-categories.ts's ensureMirrorCategories does when an admin creates one, so the
  // demo data actually exercises that behavior end to end.
  async function upsertCategory(gender: "MEN" | "WOMEN" | "UNISEX", slug: string, name: string, position: number) {
    const existing = await db.category.findFirst({ where: { gender, slug } });
    return existing
      ? db.category.update({ where: { id: existing.id }, data: { name, position } })
      : db.category.create({ data: { gender, slug, name, position } });
  }

  const catByKey = new Map<string, { id: string; slug: string; gender: string }>();
  for (const [i, c] of CATEGORY_DEFS.entries()) {
    for (const gender of ["MEN", "WOMEN"] as const) {
      const row = await upsertCategory(gender, c.slug, c.name, i);
      catByKey.set(`${gender}:${c.slug}`, row);
    }
  }
  const essentialsPos = CATEGORY_DEFS.length;
  catByKey.set("UNISEX:essentials", await upsertCategory("UNISEX", "essentials", "Essentials", essentialsPos));
  catByKey.set("MEN:essentials", await upsertCategory("MEN", "essentials", "Essentials", essentialsPos));
  catByKey.set("WOMEN:essentials", await upsertCategory("WOMEN", "essentials", "Essentials", essentialsPos));

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

  // ---------- products ----------
  const genders: Array<"MEN" | "WOMEN"> = ["MEN", "WOMEN"];
  let seedCounter = 0;
  const createdProducts: { id: string; categorySlug: string }[] = [];

  for (const category of CATEGORY_DEFS) {
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
            ...DEMO_COPY,
            gender,
            basePrice,
            status: "ACTIVE",
            categoryId: catByKey.get(`${gender}:${category.slug}`)!.id,
            publishedAt: new Date(Date.now() - publishedDaysAgo * 24 * 60 * 60 * 1000),
            seoTitle: title,
            seoDescription: `${title} — Inverted Crayon streetwear.`,
            images: {
              create: [0, 1, 2, 3].map((i) => ({
                url: "",
                alt: `${title} — view ${i + 1}`,
                position: i,
                accentColor: pick(COLORS, seedCounter + i * 3).hex,
              })),
            },
            variants: {
              create: sizes.flatMap((size, sIdx) =>
                colorsForProduct.map((color, cIdx) => {
                  const stock = (seedCounter + sIdx + cIdx) % 11; // some will be 0 (sold out)
                  const stockQty = isPreorder ? 0 : stock;
                  // Preorder-philosophy demo data: every tag-based preorder variant needs an
                  // admin-set advance (they're always at 0 stock) — a third of ordinary sold-out
                  // variants get one too, so the auto-preorder-on-stockout flash is visible on
                  // regular products without having to actually sell one out first. A quarter of
                  // those are free-to-reserve (৳0), the rest ~30% of base price.
                  const eligibleForAutoPreorder = stockQty === 0 && (isPreorder || (seedCounter + sIdx + cIdx) % 3 === 0);
                  const preorderAdvanceAmount = eligibleForAutoPreorder
                    ? (seedCounter + sIdx + cIdx) % 4 === 0
                      ? 0
                      : Math.round(basePrice * 0.3)
                    : null;
                  return {
                    sku: `${baseSlug.slice(0, 8).toUpperCase()}-${size}-${color.name.slice(0, 3).toUpperCase()}-${sIdx}${cIdx}`,
                    size,
                    color: color.name,
                    colorHex: color.hex,
                    stockQty,
                    lowStockThreshold: 5,
                    preorderAdvanceAmount,
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

      }
    }
  }

  // A couple of Unisex products under the mirrored "Essentials" category, to demo that a
  // Unisex product actually shows up when browsing either /men or /women.
  for (let i = 0; i < 2; i++) {
    seedCounter++;
    const adj = pick(ADJ, seedCounter);
    const noun = pick(NOUN.essentials, seedCounter + i);
    const title = `${adj} ${noun}`;
    const baseSlug = slugify(`${title}-unisex`);
    const basePrice = 850 + ((seedCounter * 137) % 24) * 100;
    const colorA = pick(COLORS, seedCounter);

    const product = await db.product.upsert({
      where: { slug: baseSlug },
      update: {},
      create: {
        slug: baseSlug,
        title,
        ...DEMO_COPY,
        gender: "UNISEX",
        basePrice,
        status: "ACTIVE",
        categoryId: catByKey.get("UNISEX:essentials")!.id,
        publishedAt: new Date(Date.now() - (seedCounter % 10) * 24 * 60 * 60 * 1000),
        seoTitle: title,
        seoDescription: `${title} — Inverted Crayon streetwear.`,
        images: {
          create: [0, 1].map((idx) => ({
            url: "",
            alt: `${title} — view ${idx + 1}`,
            position: idx,
            accentColor: pick(COLORS, seedCounter + idx * 3).hex,
          })),
        },
        variants: {
          create: [{ sku: `${baseSlug.slice(0, 8).toUpperCase()}-OS`, size: "One Size", color: colorA.name, colorHex: colorA.hex, stockQty: 8, lowStockThreshold: 2 }],
        },
      },
    });
    createdProducts.push({ id: product.id, categorySlug: "essentials" });
  }

  console.log(`Seeded ${createdProducts.length} products.`);

  // ---------- discounts ----------
  await db.discount.upsert({
    where: { code: "INVERT10" },
    update: {},
    create: { code: "INVERT10", type: "PERCENT", value: 10, maxDiscountAmount: 500, minSpend: 1500, usedCount: 142, active: true },
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
    paymentMethod: "BKASH" | "SSLCOMMERZ" | "COD";
    paymentStatus: "PENDING" | "PAID" | "REFUNDED";
    email: string;
    customerId?: string;
    daysAgo: number;
  }> = [
    { status: "PAID", paymentMethod: "BKASH", paymentStatus: "PAID", email: rex.email, customerId: rex.id, daysAgo: 0 },
    { status: "PENDING", paymentMethod: "COD", paymentStatus: "PENDING", email: mitu.email, customerId: mitu.id, daysAgo: 0 },
    { status: "SHIPPED", paymentMethod: "SSLCOMMERZ", paymentStatus: "PAID", email: "arif@example.com", daysAgo: 1 },
    { status: "DELIVERED", paymentMethod: "BKASH", paymentStatus: "PAID", email: "nabil@example.com", daysAgo: 1 },
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
