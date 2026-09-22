"use client";

import { useActionState } from "react";
import { subscribeNewsletter } from "@/actions/newsletter";
import { Scribble } from "@/components/brand/Scribble";

export function NewsletterForm() {
  const [state, formAction, pending] = useActionState(subscribeNewsletter, null);

  return (
    <div>
      <form action={formAction} className="flex border border-line-2 bg-[#141416]">
        <input
          type="email"
          name="email"
          required
          placeholder="Enter your email"
          className="w-[220px] max-w-[50vw] bg-transparent px-3.5 py-[11px] outline-none"
        />
        <button type="submit" disabled={pending} aria-label="Subscribe" className="bg-lime px-3.5 disabled:opacity-60">
          <Scribble shape="arrow" color="#0c0c0d" className="h-4 w-4" />
        </button>
      </form>
      {state && (
        <p className={`mt-1.5 text-[12px] ${state.ok ? "text-lime" : "text-error"}`}>{state.message}</p>
      )}
    </div>
  );
}
