"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/actions/customer-profile";

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [n, setN] = useState(name);
  const [p, setP] = useState(phone);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <div className="border border-line bg-panel p-4.5">
      <h3 className="font-impact mb-3.5 text-lg uppercase">Profile</h3>
      <div className="grid gap-2.5 desktop:grid-cols-2">
        <div>
          <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Name</label>
          <input value={n} onChange={(e) => setN(e.target.value)} className="w-full border border-line-2 bg-ink px-2.5 py-2 text-sm" />
        </div>
        <div>
          <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Phone</label>
          <input value={p} onChange={(e) => setP(e.target.value)} className="w-full border border-line-2 bg-ink px-2.5 py-2 text-sm" />
        </div>
      </div>
      <div className="mt-2.5">
        <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Email</label>
        <input value={email} disabled className="w-full border border-line-2 bg-ink px-2.5 py-2 text-sm text-muted" />
      </div>
      <button
        disabled={pending}
        onClick={() => startTransition(async () => { await updateProfile(n, p); setSaved(true); setTimeout(() => setSaved(false), 2000); })}
        className="btn-primary mt-3 bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
      >
        {saved ? "Saved ✓" : "Save"}
      </button>
    </div>
  );
}
