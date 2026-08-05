import { AuthView } from "@/components/auth/auth-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Candidate Authentication | MeritNama",
  description: "Access your MeritNama candidate portal.",
};

export default function AuthPage() {
  return <AuthView initialMode="signin" />;
}
