"use client";

import { useState, useTransition } from "react";
import { saveStoreInfo, saveChatWidgetSettings } from "@/actions/admin-settings";
import { Panel } from "@/components/admin/Panel";
import { StaffManager } from "@/components/admin/StaffManager";
import { TwoFactorSetup } from "@/components/admin/TwoFactorSetup";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import type { ChatWidgetSettings, StoreInfo } from "@/lib/store-settings";

const TABS = ["Store", "Roles", "Security", "Chat"] as const;

export function SettingsView({
  storeInfo: initialInfo,
  chatWidget: initialChatWidget,
  staff,
  selfId,
  twoFactorEnabled,
}: {
  storeInfo: StoreInfo;
  chatWidget: ChatWidgetSettings;
  staff: { id: string; email: string; name: string; role: "ADMIN" | "STAFF" }[];
  selfId: string;
  twoFactorEnabled: boolean;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Store");
  const [info, setInfo] = useState(initialInfo);
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

      {tab === "Roles" && <StaffManager users={staff} selfId={selfId} />}

      {tab === "Security" && (
        <>
          <TwoFactorSetup enabled={twoFactorEnabled} />
          <ChangePasswordForm />
        </>
      )}

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
              {key === "email" && (
                <p className="mt-1 text-[12px] text-muted-2">
                  Use your official mailbox. It&apos;s where your team&apos;s notifications go — new orders, contact
                  messages, return and cancellation requests and so on (edit what they say under Templates) — and
                  where customers&apos; replies to the site&apos;s emails land. Sending is set up on the Emails page.
                </p>
              )}
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
