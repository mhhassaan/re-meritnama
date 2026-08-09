import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export const metadata: Metadata = {
  title: "Set Your Password | MeritNama",
};

/**
 * Where invite and recovery links land.
 *
 * Reaching this page already requires a valid session, created by the callback
 * route when it verified the emailed token. Anyone arriving without one has not
 * proven control of the address and is sent back.
 */
export default async function UpdatePasswordPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect(
      "/auth?error=" +
        encodeURIComponent(
          "Open the link from your email to set a password. Links expire after a short time."
        )
    );
  }

  return <UpdatePasswordForm email={user.email ?? ""} />;
}
