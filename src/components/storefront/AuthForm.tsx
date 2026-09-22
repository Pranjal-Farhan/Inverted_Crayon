"use client";

import { useActionState, useState } from "react";
import { customerLogin, customerRegister } from "@/actions/customer-auth";
import { Button } from "@/components/ui/Button";

export function AuthForm({ initialTab = "login" }: { initialTab?: "login" | "register" }) {
  const [tab, setTab] = useState<"login" | "register">(initialTab);
  const [loginState, loginAction, loginPending] = useActionState(customerLogin, null);
  const [registerState, registerAction, registerPending] = useActionState(customerRegister, null);

  return (
    <div className="mx-auto my-10 max-w-[420px] border border-line bg-panel p-7.5">
      <h1 className="font-impact text-[34px] uppercase">{tab === "login" ? "Log in" : "Register"}</h1>
      <div className="mb-5 mt-3 flex border border-line-2">
        <button
          onClick={() => setTab("login")}
          className={`flex-1 py-2.5 font-label text-[15px] tracking-[1px] ${tab === "login" ? "bg-lime text-ink" : "text-muted"}`}
        >
          LOGIN
        </button>
        <button
          onClick={() => setTab("register")}
          className={`flex-1 py-2.5 font-label text-[15px] tracking-[1px] ${tab === "register" ? "bg-lime text-ink" : "text-muted"}`}
        >
          REGISTER
        </button>
      </div>

      {tab === "login" ? (
        <form action={loginAction}>
          <div className="mb-3">
            <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Email</label>
            <input name="email" type="email" required className="w-full border border-line-2 bg-ink px-3 py-2.5 outline-none focus:border-lime" />
          </div>
          <div className="mb-3">
            <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Password</label>
            <input name="password" type="password" required className="w-full border border-line-2 bg-ink px-3 py-2.5 outline-none focus:border-lime" />
          </div>
          {loginState && !loginState.ok && <p className="mb-3 text-[13px] text-error">{loginState.error}</p>}
          <Button type="submit" className="w-full" arrow={false} loading={loginPending}>
            Log in
          </Button>
        </form>
      ) : (
        <form action={registerAction}>
          <div className="mb-3">
            <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Name</label>
            <input name="name" required className="w-full border border-line-2 bg-ink px-3 py-2.5 outline-none focus:border-lime" />
          </div>
          <div className="mb-3">
            <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Email</label>
            <input name="email" type="email" required className="w-full border border-line-2 bg-ink px-3 py-2.5 outline-none focus:border-lime" />
          </div>
          <div className="mb-3">
            <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Password</label>
            <input name="password" type="password" required minLength={8} className="w-full border border-line-2 bg-ink px-3 py-2.5 outline-none focus:border-lime" />
          </div>
          {registerState && !registerState.ok && <p className="mb-3 text-[13px] text-error">{registerState.error}</p>}
          <Button type="submit" className="w-full" arrow={false} loading={registerPending}>
            Create account
          </Button>
        </form>
      )}

      <p className="font-label mt-3.5 text-center text-[13px] tracking-[1.4px] text-muted">
        Guest orders auto-claim by email when you register.
      </p>
    </div>
  );
}
