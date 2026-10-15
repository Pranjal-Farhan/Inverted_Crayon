"use client";

import { useActionState } from "react";
import { sendTestEmail, type TestEmailResult } from "@/actions/admin-email";

export function EmailTestForm({ defaultTo }: { defaultTo: string }) {
  const [state, action, pending] = useActionState<TestEmailResult | null, FormData>(sendTestEmail, null);

  return (
    <form action={action} className="mt-3.5 border-t border-line pt-3.5">
      <label htmlFor="test-email-to" className="font-label mb-1.5 block text-[12px] tracking-[1.2px] text-muted">
        SEND A TEST EMAIL TO
      </label>
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          id="test-email-to"
          name="to"
          type="email"
          required
          defaultValue={defaultTo}
          className="min-w-[240px] flex-1 border border-line-2 bg-ink px-2.5 py-2 text-sm outline-none focus:border-lime"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send test email"}
        </button>
      </div>
      {state && (
        <p className={`mt-2 text-[13px] ${state.ok ? "text-lime" : "text-error"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
