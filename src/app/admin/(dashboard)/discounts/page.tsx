import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { couponStatus } from "@/lib/coupon-format";
import { DiscountManager, type CouponRow } from "@/components/admin/DiscountManager";

// Each coupon lists its most recent uses inline; a very popular code shows the latest slice and
// says how many there are in all, rather than rendering thousands of rows into one page.
const MAX_USES_LISTED = 100;

export default async function AdminDiscountsPage() {
  const [coupons, totals] = await Promise.all([
    db.discount.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { products: true } },
        redemptions: {
          orderBy: { createdAt: "desc" },
          take: MAX_USES_LISTED,
          include: {
            order: {
              select: {
                id: true,
                number: true,
                email: true,
                status: true,
                customer: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
    }),
    db.discountRedemption.groupBy({ by: ["discountId"], _sum: { amount: true }, _count: { _all: true } }),
  ]);
  const totalsById = new Map(totals.map((t) => [t.discountId, t]));
  const now = new Date();

  const rows: CouponRow[] = coupons.map((c) => {
    const t = totalsById.get(c.id);
    return {
      id: c.id,
      code: c.code,
      type: c.type,
      value: toNumber(c.value),
      maxDiscountAmount: c.maxDiscountAmount != null ? toNumber(c.maxDiscountAmount) : null,
      minSpend: c.minSpend != null ? toNumber(c.minSpend) : null,
      firstOrderOnly: c.firstOrderOnly,
      usageLimit: c.usageLimit,
      usedCount: c.usedCount,
      startsAt: c.startsAt?.toISOString() ?? null,
      endsAt: c.endsAt?.toISOString() ?? null,
      scope: c.scope,
      active: c.active,
      status: couponStatus(c, now),
      productCount: c._count.products,
      totalDeducted: t?._sum.amount != null ? toNumber(t._sum.amount) : 0,
      redemptionCount: t?._count._all ?? 0,
      uses: c.redemptions.map((r) => ({
        id: r.id,
        amount: toNumber(r.amount),
        at: r.createdAt.toISOString(),
        orderId: r.order.id,
        orderNumber: r.order.number,
        orderStatus: r.order.status,
        customerId: r.order.customer?.id ?? null,
        // A guest order has no account to link to — show the email it was placed with instead.
        customerLabel: r.order.customer ? (r.order.customer.name ?? r.order.customer.email) : r.order.email,
      })),
    };
  });

  return <DiscountManager coupons={rows} maxUsesListed={MAX_USES_LISTED} />;
}
