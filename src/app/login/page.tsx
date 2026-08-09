import { Suspense } from "react";
import { AuthView } from "@/components/auth/auth-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Candidate Login | MeritNama Punjab Residency Induction",
  description:
    "Sign in to your MeritNama account to access personalized PMDC merit calculator models, historical gazette cutoffs, and multi-round preference cascade simulations.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthView initialMode="signin" />
    </Suspense>
  );
}
