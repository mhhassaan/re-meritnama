import { Suspense } from "react";
import { AuthView } from "@/components/auth/auth-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Candidate Registration | MeritNama Punjab Residency Induction",
  description:
    "Create your MeritNama account using your PMDC registration number to unlock personalized Punjab medical induction cutoff analytics and real-time war room feeds.",
};

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <AuthView initialMode="signup" />
    </Suspense>
  );
}
