import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { Panel } from "@/components/admin/Panel";
import { TEMPLATES } from "@/lib/message-templates";
import { describeEmailProvider } from "@/lib/email-provider";
import { getStoreInfo } from "@/lib/store-settings";
import { EmailTestForm } from "@/components/admin/EmailTestForm";

// Labels come from the template catalog so a new message type shows up here automatically; the
// retired abandoned-bag reminder and preorder ship-date email keep a label only so old outbox
// rows still read properly.
const TYPE_LABEL: Record<string, string> = {
  ...Object.fromEntries(TEMPLATES.map((t) => [t.key, t.title])),
  ABANDONED_CHECKOUT: "Abandoned checkout (retired)",
  PREORDER_SHIP_UPDATE: "Preorder ship date update (retired)",
};
const CUSTOMER_TYPES = TEMPLATES.filter((t) => t.audience === "CUSTOMER");
const BRAND_TYPES = TEMPLATES.filter((t) => t.audience === "BRAND");

type Props = { searchParams: Promise<{ type?: string; q?: string }> };

export default async function AdminEmailsPage({ searchParams }: Props) {
  await requireAdminPage("emails");
  const { type, q } = await searchParams;

  const store = await getStoreInfo();
  const delivery = describeEmailProvider(store.name);

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
      <Panel title="Email delivery" className="mb-4.5">
        {delivery.provider ? (
          <p className="text-[13px] text-muted">
            <span className="font-label mr-1.5 tracking-[1px] text-lime">● LIVE</span>
            Sending through {delivery.provider === "smtp" ? "your mail server" : "Resend"}{" "}
            <span className="text-paper">({delivery.host})</span> as <span className="text-paper">{delivery.from}</span>.
            Customers&apos; replies go to <span className="text-paper">{store.email}</span>, and so do the team&apos;s
            notifications (change that in Settings → Store).
          </p>
        ) : (
          <p className="text-[13px] text-muted">
            <span className="font-label mr-1.5 tracking-[1px] text-yellow">● NOT CONNECTED</span>
            Emails are only recorded below — none are leaving yet. To send from your official mailbox, add its
            SMTP settings to the server&apos;s environment (<code className="text-paper">SMTP_HOST</code>,{" "}
            <code className="text-paper">SMTP_USER</code>, <code className="text-paper">SMTP_PASS</code>) — the
            steps are in the README under &ldquo;Email setup&rdquo;.
          </p>
        )}
        {delivery.provider && <EmailTestForm defaultTo={store.email} />}
      </Panel>
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
          <option value="PREORDER_SHIP_UPDATE">Preorder ship date update (retired)</option>
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
              {["To", "Type", "Subject", "Sent", "Delivery"].map((h) => (
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
                  {e.attachmentNames.length > 0 && (
                    <div className="mt-1 text-[12px] text-cyan">📎 {e.attachmentNames.join(", ")}</div>
                  )}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap">
                  {e.sentAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}{" "}
                  {e.sentAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-4 py-2.5">
                  {e.delivery === "SENT" && <span className="font-label tracking-[0.8px] text-lime">SENT</span>}
                  {e.delivery === "LOGGED" && (
                    <span className="font-label tracking-[0.8px] text-muted-2" title="Recorded only — no email provider was connected">
                      NOT SENT
                    </span>
                  )}
                  {e.delivery === "FAILED" && (
                    <>
                      <span className="font-label tracking-[0.8px] text-error">FAILED</span>
                      {e.deliveryError && <div className="mt-0.5 max-w-[260px] text-[12px] text-error/80">{e.deliveryError}</div>}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {emails.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
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
