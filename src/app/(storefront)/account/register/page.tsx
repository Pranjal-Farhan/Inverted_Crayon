import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/storefront/AuthForm";

export const metadata: Metadata = { title: "Register" };

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm initialTab="register" />
    </Suspense>
  );
}
