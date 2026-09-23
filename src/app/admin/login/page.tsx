import type { Metadata } from "next";
import { Suspense } from "react";
import { Monogram } from "@/components/brand/Monogram";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = { title: "Admin login" };

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 text-paper">
      <div className="w-full max-w-[380px] border border-line bg-panel p-7">
        <div className="mb-5 flex items-center gap-2.5">
          <Monogram className="h-6 w-7" />
          <span className="font-scrawl text-lg">Admin</span>
        </div>
        <Suspense fallback={null}>
          <AdminLoginForm />
        </Suspense>
      </div>
    </div>
  );
}
