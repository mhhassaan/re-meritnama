import { Suspense } from "react";
import { AuthView } from "@/components/auth/auth-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Candidate Authentication | MeritNama",
  description: "Access your MeritNama candidate portal.",
};

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthView initialMode="signin" />
    </Suspense>
  );
}
