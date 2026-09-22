"use client";

import { useActionState } from "react";
import { sendContactMessage } from "@/actions/contact";
import { Button } from "@/components/ui/Button";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(sendContactMessage, null);

  if (state?.ok) {
    return <p className="text-lime">{state.message}</p>;
  }

  return (
    <form action={formAction}>
      <div className="field mb-3">
        <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Name</label>
        <input name="name" required className="w-full border border-line-2 bg-ink px-3 py-2.5 outline-none focus:border-lime" />
      </div>
      <div className="field mb-3">
        <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Email</label>
        <input name="email" type="email" required className="w-full border border-line-2 bg-ink px-3 py-2.5 outline-none focus:border-lime" />
      </div>
      <div className="field mb-3">
        <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Message</label>
        <textarea name="message" required rows={4} className="w-full border border-line-2 bg-ink px-3 py-2.5 outline-none focus:border-lime" />
      </div>
      {state && !state.ok && <p className="mb-2 text-[13px] text-error">{state.message}</p>}
      <Button type="submit" size="sm" arrow={false} loading={pending}>
        Send
      </Button>
    </form>
  );
}
