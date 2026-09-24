"use client";

import { useActionState, useState } from "react";
import { initiateTwoFactorSetup, confirmTwoFactorSetup, disableTwoFactor } from "@/actions/admin-2fa";
import { Panel } from "@/components/admin/Panel";

export function TwoFactorSetup({ enabled: initialEnabled }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setupData, setSetupData] = useState<{ qrDataUrl: string; manualKey: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmTwoFactorSetup, null);
  const [disableState, disableAction, disablePending] = useActionState(disableTwoFactor, null);
  const [savedCodes, setSavedCodes] = useState<string[] | null>(null);

  if (confirmState?.ok && confirmState.backupCodes.length > 0 && !savedCodes) {
    setSavedCodes(confirmState.backupCodes);
    setEnabled(true);
  }

  async function startSetup() {
    setStarting(true);
    setStartError("");
    const result = await initiateTwoFactorSetup();
    setStarting(false);
    if (!result.ok) {
      setStartError(result.error);
      return;
    }
    setSetupData({ qrDataUrl: result.qrDataUrl, manualKey: result.manualKey });
  }

  if (disableState?.ok) {
    return (
      <Panel title="Two-factor authentication">
        <p className="text-sm text-muted">Two-factor authentication has been disabled on this account.</p>
      </Panel>
    );
  }

  if (savedCodes) {
    return (
      <Panel title="Two-factor authentication">
        <p className="mb-3 text-sm text-lime">Two-factor authentication is now enabled.</p>
        <p className="mb-3 text-[13px] text-muted">
          Save these one-time backup codes somewhere safe — each can be used once to sign in if you lose access to
          your authenticator app. They won&apos;t be shown again.
        </p>
        <div className="mb-3 grid grid-cols-2 gap-2 border border-line-2 bg-ink p-3 font-mono text-sm">
          {savedCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <button onClick={() => setSavedCodes(null)} className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink">
          Done
        </button>
      </Panel>
    );
  }

  if (enabled) {
    return (
      <Panel title="Two-factor authentication">
        <p className="mb-3 text-sm text-lime">Two-factor authentication is enabled on this account.</p>
        <form action={disableAction}>
          <p className="mb-2 text-[13px] text-muted">Enter your password to disable it.</p>
          <div className="mb-3 flex max-w-sm gap-2">
            <input
              name="password"
              type="password"
              required
              className="flex-1 border border-line-2 bg-ink px-3 py-2 text-sm outline-none focus:border-lime"
            />
            <button
              type="submit"
              disabled={disablePending}
              className="border border-line-2 px-4 py-2 text-sm text-error hover:border-error disabled:opacity-50"
            >
              {disablePending ? "Disabling…" : "Disable"}
            </button>
          </div>
          {disableState && !disableState.ok && <p className="text-[13px] text-error">{disableState.error}</p>}
        </form>
      </Panel>
    );
  }

  if (setupData) {
    return (
      <Panel title="Two-factor authentication">
        <p className="mb-3 text-[13px] text-muted">
          Scan this QR code with Google Authenticator (or any TOTP app), or enter the key manually — then confirm
          with the 6-digit code it shows.
        </p>
        <div className="mb-3 flex flex-wrap items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- runtime-generated data URI, not an optimizable asset */}
          <img src={setupData.qrDataUrl} alt="2FA setup QR code" width={180} height={180} className="border border-line-2" />
          <div>
            <p className="font-label mb-1 text-[12px] tracking-[1px] text-muted">Manual entry key</p>
            <p className="mb-3 break-all font-mono text-sm">{setupData.manualKey}</p>
            <form action={confirmAction} className="flex max-w-xs gap-2">
              <input
                name="code"
                type="text"
                inputMode="numeric"
                required
                placeholder="123456"
                className="w-28 border border-line-2 bg-ink px-3 py-2 text-sm tracking-[3px] outline-none focus:border-lime"
              />
              <button
                type="submit"
                disabled={confirmPending}
                className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
              >
                {confirmPending ? "Verifying…" : "Confirm"}
              </button>
            </form>
            {confirmState && !confirmState.ok && <p className="mt-2 text-[13px] text-error">{confirmState.error}</p>}
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Two-factor authentication">
      <p className="mb-3 text-[13px] text-muted">
        Add an extra layer of security to your login with a 6-digit code from an authenticator app like Google
        Authenticator.
      </p>
      {startError && <p className="mb-2 text-[13px] text-error">{startError}</p>}
      <button
        onClick={startSetup}
        disabled={starting}
        className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
      >
        {starting ? "Starting…" : "Set up two-factor authentication"}
      </button>
    </Panel>
  );
}
