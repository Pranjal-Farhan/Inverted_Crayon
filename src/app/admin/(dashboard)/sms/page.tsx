import { db } from "@/lib/db";
import { Panel } from "@/components/admin/Panel";

const TYPE_LABEL: Record<string, string> = {
  ORDER_CONFIRMED_PAID: "Order confirmed — paid",
  ORDER_CONFIRMED_COD: "Order confirmed — COD",
  ORDER_CONFIRMED_PARTIAL: "Order confirmed — partial (preorder)",
};

type Props = { searchParams: Promise<{ type?: string; q?: string }> };

export default async function AdminSmsPage({ searchParams }: Props) {
  const { type, q } = await searchParams;

  const messages = await db.smsLog.findMany({
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
        SMS is mocked unless SSL Wireless credentials are set — every &quot;send&quot; lands here regardless. This is
        the outbox.
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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-2 text-left text-muted">
              {["To", "Type", "Message", "Sent"].map((h) => (
                <th key={h} className="font-label px-4 py-2.5 text-[13px] tracking-[0.8px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id} className="border-b border-line align-top">
                <td className="px-4 py-2.5 whitespace-nowrap">{m.to}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{TYPE_LABEL[m.type] ?? m.type}</td>
                <td className="px-4 py-2.5 text-[12px] text-muted">{m.body}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {m.sentAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}{" "}
                  {m.sentAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </td>
              </tr>
            ))}
            {messages.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  No SMS sent yet.
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
