"use client";

import { useActionState } from "react";
import { changeOwnPassword, type ChangePasswordResult } from "@/actions/admin-password";
import { Panel } from "@/components/admin/Panel";

const inputClass = "w-full border border-line-2 bg-ink px-2.5 py-2 text-sm outline-none focus:border-lime";

/** "Change password" for the signed-in account — shown to admins and staff alike (their own only). */
export function ChangePasswordForm() {
  const [state, action, pending] = useActionState<ChangePasswordResult | null, FormData>(changeOwnPassword, null);

  return (
    <Panel title="Change password" className="mt-4.5">
      <p className="mb-3 text-[13px] text-muted">
        Changes the password for your own account. You&apos;ll stay signed in here; any other device signed in to this
        account is signed out.
      </p>
      {/* keyed on success so the three boxes clear themselves after a change */}
      <form key={state?.ok ? "done" : "form"} action={action} className="grid max-w-[420px] gap-3">
        <div>
          <label htmlFor="pw-current" className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">
            Current password
          </label>
          <input id="pw-current" name="current" type="password" autoComplete="current-password" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="pw-next" className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">
            New password <span className="text-muted-2">(at least 8 characters)</span>
          </label>
          <input id="pw-next" name="next" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className={inputClass} />
        </div>
        <div>
          <label htmlFor="pw-confirm" className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">
            Confirm new password
          </label>
          <input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className={inputClass} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
          >
            {pending ? "Saving…" : "Change password"}
          </button>
          {state && (
            <span role="status" className={`text-[13px] ${state.ok ? "text-lime" : "text-error"}`}>
              {state.message}
            </span>
          )}
        </div>
      </form>
    </Panel>
  );
}
