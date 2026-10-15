"use client";

import { useActionState } from "react";
import { sendTestSms, type TestSmsResult } from "@/actions/admin-sms";

export function SmsTestForm({ defaultTo }: { defaultTo: string }) {
  const [state, action, pending] = useActionState<TestSmsResult | null, FormData>(sendTestSms, null);

  return (
    <form action={action} className="mt-3.5 border-t border-line pt-3.5">
      <label htmlFor="test-sms-to" className="font-label mb-1.5 block text-[12px] tracking-[1.2px] text-muted">
        SEND A TEST SMS TO
      </label>
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          id="test-sms-to"
          name="to"
          type="tel"
          required
          defaultValue={defaultTo}
          placeholder="01712345678"
          className="min-w-[200px] flex-1 border border-line-2 bg-ink px-2.5 py-2 text-sm outline-none focus:border-lime"
        />
        <button
          type="submit"
          disabled={pending}
          className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send test SMS"}
        </button>
      </div>
      <p className="mt-1.5 text-[12px] text-muted-2">Costs one SMS from your gateway balance.</p>
      {state && (
        <p className={`mt-2 text-[13px] ${state.ok ? "text-lime" : "text-error"}`} role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
