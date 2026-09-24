"use client";

import { useState, useTransition } from "react";
import {
  saveShippingRates,
  savePaymentGateways,
  saveStoreInfo,
  saveTaxSettings,
  saveEmailTemplates,
  saveChatWidgetSettings,
} from "@/actions/admin-settings";
import { Panel } from "@/components/admin/Panel";
import { StaffManager } from "@/components/admin/StaffManager";
import { TwoFactorSetup } from "@/components/admin/TwoFactorSetup";
import type { ChatWidgetSettings, EmailTemplates, PaymentGatewaySettings, ShippingRates, StoreInfo, TaxSettings } from "@/lib/store-settings";

const TABS = ["Payments", "Shipping", "Tax", "Emails", "Roles", "Security", "Chat", "Store"] as const;

const EMAIL_TYPE_LABEL: Record<keyof EmailTemplates, string> = {
  WELCOME: "Newsletter welcome",
  ORDER_CONFIRMED: "Order confirmed",
  ORDER_SHIPPED: "It's shipped",
  BACK_IN_STOCK: "Back in stock",
  PREORDER_SHIP_UPDATE: "Preorder ship update",
  ABANDONED_CHECKOUT: "Abandoned checkout reminder",
  CONTACT_RECEIVED: "Contact form received",
};

export function SettingsView({
  rates: initialRates,
  gateways: initialGateways,
  storeInfo: initialInfo,
  tax: initialTax,
  emailTemplates: initialTemplates,
  chatWidget: initialChatWidget,
  staff,
  selfId,
  twoFactorEnabled,
}: {
  rates: ShippingRates;
  gateways: PaymentGatewaySettings;
  storeInfo: StoreInfo;
  tax: TaxSettings;
  emailTemplates: EmailTemplates;
  chatWidget: ChatWidgetSettings;
  staff: { id: string; email: string; name: string; role: "ADMIN" | "STAFF" }[];
  selfId: string;
  twoFactorEnabled: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Payments");
  const [rates, setRates] = useState(initialRates);
  const [gateways, setGateways] = useState(initialGateways);
  const [info, setInfo] = useState(initialInfo);
  const [tax, setTax] = useState(initialTax);
  const [templates, setTemplates] = useState(initialTemplates);
  const [chatWidget, setChatWidget] = useState(initialChatWidget);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function flashSaved() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap gap-3.5 font-label text-sm tracking-[1px] text-muted">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? "text-lime" : "hover:text-paper"}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Payments" && (
        <Panel title="Payment gateways">
          <div className="flex flex-wrap gap-4">
            {(["bkash", "sslcommerz", "cod"] as const).map((key) => (
              <label key={key} className="inline-flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={gateways[key]}
                  onChange={(e) => setGateways((g) => ({ ...g, [key]: e.target.checked }))}
                />
                {key === "sslcommerz" ? "SSLCommerz (cards)" : key === "cod" ? "Cash on delivery" : key[0].toUpperCase() + key.slice(1)}
              </label>
            ))}
          </div>
          <div className="mt-3">
            <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">COD rule</label>
            <select
              value={gateways.codRule}
              onChange={(e) => setGateways((g) => ({ ...g, codRule: e.target.value as PaymentGatewaySettings["codRule"] }))}
              className="border border-line-2 bg-ink px-3 py-2 text-sm"
            >
              <option value="inside_dhaka_only">Inside Dhaka only</option>
              <option value="nationwide">Nationwide</option>
            </select>
          </div>
          <SaveBtn
            pending={pending}
            saved={saved}
            onClick={() => startTransition(async () => { await savePaymentGateways(gateways); flashSaved(); })}
          />
        </Panel>
      )}

      {tab === "Shipping" && (
        <Panel title="Shipping zones">
          {(["INSIDE_DHAKA", "OUTSIDE_DHAKA", "INTERNATIONAL"] as const).map((zone) => (
            <div key={zone} className="mb-3 grid grid-cols-3 gap-2.5">
              <input
                value={rates[zone].label}
                onChange={(e) => setRates((r) => ({ ...r, [zone]: { ...r[zone], label: e.target.value } }))}
                className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
              />
              <input
                type="number"
                value={rates[zone].cost}
                onChange={(e) => setRates((r) => ({ ...r, [zone]: { ...r[zone], cost: Number(e.target.value) } }))}
                className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
              />
              <input
                value={rates[zone].etaDays}
                onChange={(e) => setRates((r) => ({ ...r, [zone]: { ...r[zone], etaDays: e.target.value } }))}
                className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
              />
            </div>
          ))}
          <SaveBtn
            pending={pending}
            saved={saved}
            onClick={() => startTransition(async () => { await saveShippingRates(rates); flashSaved(); })}
          />
        </Panel>
      )}

      {tab === "Tax" && (
        <Panel title="Tax">
          <label className="mb-3 flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={tax.inclusive} onChange={(e) => setTax((t) => ({ ...t, inclusive: e.target.checked }))} />
            Prices include tax
          </label>
          <div className="grid grid-cols-1 gap-2.5 desktop:grid-cols-2">
            <div>
              <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Rate (%)</label>
              <input
                type="number"
                value={tax.rate}
                onChange={(e) => setTax((t) => ({ ...t, rate: Number(e.target.value) }))}
                className="w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Label</label>
              <input
                value={tax.label}
                onChange={(e) => setTax((t) => ({ ...t, label: e.target.value }))}
                className="w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
              />
            </div>
          </div>
          <p className="mt-2 text-[12px] text-muted">
            Bangladesh apparel pricing is typically tax-inclusive — this stays informational unless you switch to
            exclusive pricing.
          </p>
          <SaveBtn pending={pending} saved={saved} onClick={() => startTransition(async () => { await saveTaxSettings(tax); flashSaved(); })} />
        </Panel>
      )}

      {tab === "Emails" && (
        <Panel title="Email templates">
          <p className="mb-3 text-[13px] text-muted">Emails are mocked — toggling one off here skips writing it to the outbox.</p>
          {(Object.keys(EMAIL_TYPE_LABEL) as (keyof EmailTemplates)[]).map((key) => (
            <div key={key} className="mb-2.5 flex items-center gap-3">
              <label className="flex w-8 items-center">
                <input
                  type="checkbox"
                  checked={templates[key].enabled}
                  onChange={(e) => setTemplates((t) => ({ ...t, [key]: { ...t[key], enabled: e.target.checked } }))}
                />
              </label>
              <span className="w-[220px] shrink-0 text-sm text-muted">{EMAIL_TYPE_LABEL[key]}</span>
              <input
                value={templates[key].subject}
                onChange={(e) => setTemplates((t) => ({ ...t, [key]: { ...t[key], subject: e.target.value } }))}
                className="flex-1 border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
              />
            </div>
          ))}
          <SaveBtn
            pending={pending}
            saved={saved}
            onClick={() => startTransition(async () => { await saveEmailTemplates(templates); flashSaved(); })}
          />
        </Panel>
      )}

      {tab === "Roles" && <StaffManager users={staff} selfId={selfId} />}

      {tab === "Security" && <TwoFactorSetup enabled={twoFactorEnabled} />}

      {tab === "Chat" && (
        <Panel title="Chat bubble">
          <label className="mb-3 flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={chatWidget.enabled}
              onChange={(e) => setChatWidget((c) => ({ ...c, enabled: e.target.checked }))}
            />
            Show the chat bubble on the storefront
          </label>
          <p className="mb-3 text-[12px] text-muted">
            The bubble only shows a button for whichever of these is filled in — leave one blank to offer just the
            other.
          </p>
          <div className="grid grid-cols-1 gap-2.5 desktop:grid-cols-2">
            <div>
              <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">WhatsApp number</label>
              <input
                value={chatWidget.whatsappNumber}
                onChange={(e) => setChatWidget((c) => ({ ...c, whatsappNumber: e.target.value }))}
                placeholder="+880 1XXX-XXXXXX"
                className="w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">
                Messenger page username or ID
              </label>
              <input
                value={chatWidget.messengerUsername}
                onChange={(e) => setChatWidget((c) => ({ ...c, messengerUsername: e.target.value }))}
                placeholder="invertedcrayon"
                className="w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
              />
            </div>
          </div>
          <div className="mt-2.5">
            <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">
              WhatsApp prefilled message
            </label>
            <input
              value={chatWidget.whatsappMessage}
              onChange={(e) => setChatWidget((c) => ({ ...c, whatsappMessage: e.target.value }))}
              className="w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
            />
          </div>
          <SaveBtn
            pending={pending}
            saved={saved}
            onClick={() => startTransition(async () => { await saveChatWidgetSettings(chatWidget); flashSaved(); })}
          />
        </Panel>
      )}

      {tab === "Store" && (
        <Panel title="Store info">
          {(["name", "email", "phone", "address"] as const).map((key) => (
            <div key={key} className="mb-2.5">
              <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">{key}</label>
              <input
                value={info[key]}
                onChange={(e) => setInfo((i) => ({ ...i, [key]: e.target.value }))}
                className="w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
              />
            </div>
          ))}
          <SaveBtn
            pending={pending}
            saved={saved}
            onClick={() => startTransition(async () => { await saveStoreInfo(info); flashSaved(); })}
          />
        </Panel>
      )}
    </div>
  );
}

function SaveBtn({ pending, saved, onClick }: { pending: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={pending} className="btn-primary mt-3 bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50">
      {pending ? "Saving…" : saved ? "Saved ✓" : "Save"}
    </button>
  );
}
