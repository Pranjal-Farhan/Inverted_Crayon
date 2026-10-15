import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { Panel } from "@/components/admin/Panel";
import { TEMPLATES, smsTypeFor } from "@/lib/message-templates";
import { describeSmsProvider, normalizeBdMobile } from "@/lib/sms-provider";
import { getStoreInfo } from "@/lib/store-settings";
import { SmsTestForm } from "@/components/admin/SmsTestForm";

// Labels come from the template catalog (SMS_ORDER_SHIPPED is logged as ORDER_SHIPPED, and so on).
const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  TEMPLATES.filter((t) => t.channel === "SMS").map((t) => [smsTypeFor(t.key), t.title]),
);

type Props = { searchParams: Promise<{ type?: string; q?: string }> };

export default async function AdminSmsPage({ searchParams }: Props) {
  await requireAdminPage("sms");
  const { type, q } = await searchParams;

  const store = await getStoreInfo();
  const delivery = describeSmsProvider();

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
      <Panel title="SMS delivery" className="mb-4.5">
        {delivery.provider ? (
          <p className="text-[13px] text-muted">
            <span className="font-label mr-1.5 tracking-[1px] text-lime">● LIVE</span>
            Sending through SSL Wireless <span className="text-paper">({delivery.host})</span> with Sender ID{" "}
            <span className="text-paper">{delivery.senderId}</span>. Order texts go to the &ldquo;Phone (delivery
            SMS)&rdquo; number the customer gave at checkout. What each text says is edited in Templates.
          </p>
        ) : (
          <p className="text-[13px] text-muted">
            <span className="font-label mr-1.5 tracking-[1px] text-yellow">● NOT CONNECTED</span>
            Texts are only recorded below — none are leaving yet. To send them, add your SSL Wireless details to
            the server&apos;s environment (<code className="text-paper">SSLWIRELESS_SMS_API_TOKEN</code> and{" "}
            <code className="text-paper">SSLWIRELESS_SMS_SID</code>) — the steps are in the README under
            &ldquo;SMS setup&rdquo;.
          </p>
        )}
        {delivery.provider && <SmsTestForm defaultTo={normalizeBdMobile(store.phone) ? store.phone : ""} />}
      </Panel>
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
              {["To", "Type", "Message", "Sent", "Delivery"].map((h) => (
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
                <td className="px-4 py-2.5">
                  {m.delivery === "SENT" && (
                    <>
                      <span className="font-label tracking-[0.8px] text-lime">SENT</span>
                      {m.providerRef && <div className="mt-0.5 text-[11px] text-muted-2">ref {m.providerRef}</div>}
                    </>
                  )}
                  {m.delivery === "LOGGED" && (
                    <span className="font-label tracking-[0.8px] text-muted-2" title="Recorded only — no SMS gateway was connected">
                      NOT SENT
                    </span>
                  )}
                  {m.delivery === "FAILED" && (
                    <>
                      <span className="font-label tracking-[0.8px] text-error">FAILED</span>
                      {m.deliveryError && <div className="mt-0.5 max-w-[260px] text-[12px] text-error/80">{m.deliveryError}</div>}
                    </>
                  )}
                </td>
              </tr>
            ))}
            {messages.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
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
