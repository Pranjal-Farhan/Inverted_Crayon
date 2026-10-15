import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { Panel } from "@/components/admin/Panel";
import { TEMPLATES } from "@/lib/message-templates";

// Labels come from the template catalog so a new message type shows up here automatically; the
// retired abandoned-bag reminder keeps a label only so old outbox rows still read properly.
const TYPE_LABEL: Record<string, string> = {
  ...Object.fromEntries(TEMPLATES.filter((t) => t.channel === "EMAIL").map((t) => [t.key, t.title])),
  ABANDONED_CHECKOUT: "Abandoned checkout (retired)",
};
const CUSTOMER_TYPES = TEMPLATES.filter((t) => t.channel === "EMAIL" && t.audience === "CUSTOMER");
const BRAND_TYPES = TEMPLATES.filter((t) => t.channel === "EMAIL" && t.audience === "BRAND");

type Props = { searchParams: Promise<{ type?: string; q?: string }> };

export default async function AdminEmailsPage({ searchParams }: Props) {
  await requireAdminPage("emails");
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
        Every email the site sends is recorded here. It only leaves for a real inbox once an email provider is
        connected — until then this is where you can see exactly what would have been sent.
      </p>
      <form className="mb-3.5 flex flex-wrap items-center gap-2.5" method="get">
        <input name="q" defaultValue={q} placeholder="Search recipient…" className="border border-line-2 bg-panel px-2.5 py-2 text-sm outline-none focus:border-lime" />
        <select name="type" defaultValue={type ?? ""} className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          <option value="">All types</option>
          <optgroup label="To customers">
            {CUSTOMER_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.title}
              </option>
            ))}
          </optgroup>
          <optgroup label="To the brand">
            {BRAND_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.title}
              </option>
            ))}
          </optgroup>
          <option value="ABANDONED_CHECKOUT">Abandoned checkout (retired)</option>
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
        </div>
      </Panel>
    </div>
  );
}
