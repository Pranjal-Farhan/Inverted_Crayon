"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { adminLogin } from "@/actions/admin-auth";
import { Button } from "@/components/ui/Button";
import { OAuthButtons, OAuthErrorBanner } from "@/components/auth/OAuthButtons";

export function AdminLoginForm() {
  const [state, formAction, pending] = useActionState(adminLogin, null);
  const searchParams = useSearchParams();

  return (
    <>
      <OAuthErrorBanner code={searchParams.get("oauth")} />
      <OAuthButtons intent="admin" />
      <form action={formAction}>
      <div className="mb-3">
        <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Email</label>
        <input name="email" type="email" required className="w-full border border-line-2 bg-ink px-3 py-2.5 outline-none focus:border-lime" />
      </div>
      <div className="mb-3">
        <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Password</label>
        <input name="password" type="password" required className="w-full border border-line-2 bg-ink px-3 py-2.5 outline-none focus:border-lime" />
      </div>
      {state && !state.ok && <p className="mb-3 text-[13px] text-error">{state.error}</p>}
      <Button type="submit" className="w-full" arrow={false} loading={pending}>
        Log in
      </Button>
    </form>
    </>
  );
}
