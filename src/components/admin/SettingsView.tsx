"use client";

import { useState, useTransition } from "react";
import { saveShippingRates, savePaymentGateways, saveStoreInfo } from "@/actions/admin-settings";
import { Panel } from "@/components/admin/Panel";
import type { PaymentGatewaySettings, ShippingRates, StoreInfo } from "@/lib/store-settings";

const TABS = ["Payments", "Shipping", "Store"] as const;

export function SettingsView({
  rates: initialRates,
  gateways: initialGateways,
  storeInfo: initialInfo,
}: {
  rates: ShippingRates;
  gateways: PaymentGatewaySettings;
  storeInfo: StoreInfo;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Payments");
  const [rates, setRates] = useState(initialRates);
  const [gateways, setGateways] = useState(initialGateways);
  const [info, setInfo] = useState(initialInfo);
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
            {(["bkash", "nagad", "sslcommerz", "cod"] as const).map((key) => (
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

      <Panel title="Staff roles" className="mt-4.5">
        <p className="text-sm text-muted">Admin — full access · Staff — fulfil orders, no refunds or settings.</p>
      </Panel>
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
