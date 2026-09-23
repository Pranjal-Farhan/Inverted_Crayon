import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/storefront/AuthForm";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm initialTab="login" />
    </Suspense>
  );
}
