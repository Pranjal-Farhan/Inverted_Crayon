import { db } from "@/lib/db";
import { Panel } from "@/components/admin/Panel";

const TYPE_LABEL: Record<string, string> = {
  WELCOME: "Welcome",
  ORDER_CONFIRMED: "Order confirmed",
  ORDER_SHIPPED: "Shipped",
  BACK_IN_STOCK: "Back in stock",
  PREORDER_SHIP_UPDATE: "Preorder update",
  ABANDONED_CHECKOUT: "Abandoned checkout",
  CONTACT_RECEIVED: "Contact received",
};

type Props = { searchParams: Promise<{ type?: string; q?: string }> };

export default async function AdminEmailsPage({ searchParams }: Props) {
  const { type, q } = await searchParams;

  const emails = await db.emailLog.findMany({
    where: {
      type: type ? (type as never) : undefined,
      to: q ? { contains: q, mode: "insensitive" } : undefined,
    },
    orderBy: { sentAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <p className="mb-3.5 text-[13px] text-muted">
        Emails are mocked — every &quot;send&quot; lands here instead of a real inbox. This is the outbox.
      </p>
      <form className="mb-3.5 flex flex-wrap items-center gap-2.5" method="get">
        <input name="q" defaultValue={q} placeholder="Search recipient…" className="border border-line-2 bg-panel px-2.5 py-2 text-sm outline-none focus:border-lime" />
        <select name="type" defaultValue={type ?? ""} className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          <option value="">All types</option>
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="border border-line-2 px-3 py-2 text-sm hover:border-lime">
          Filter
        </button>
      </form>

      <Panel className="!p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-2 text-left text-muted">
              {["To", "Type", "Subject", "Sent"].map((h) => (
                <th key={h} className="font-label px-4 py-2.5 text-[13px] tracking-[0.8px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {emails.map((e) => (
              <tr key={e.id} className="border-b border-line align-top">
                <td className="px-4 py-2.5">{e.to}</td>
                <td className="px-4 py-2.5">{TYPE_LABEL[e.type] ?? e.type}</td>
                <td className="px-4 py-2.5">
                  <div>{e.subject}</div>
                  <div className="mt-0.5 text-[12px] text-muted">{e.body}</div>
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {e.sentAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}{" "}
                  {e.sentAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            ))}
            {emails.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  No emails sent yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
