import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set — see .env.example.");
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    // The product purchase cost is an admin/finance figure. Leaving it out of every query by
    // default means no storefront query, API route or cache entry can ever carry it by accident —
    // the few admin places that need it ask for it explicitly (select: { purchaseCost: true } or
    // omit: { purchaseCost: false }).
    omit: { product: { purchaseCost: true } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
