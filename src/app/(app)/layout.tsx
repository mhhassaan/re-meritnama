import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";

/**
 * Authenticated candidate shell.
 *
 * This gate is real enforcement, unlike the Proxy redirect — the Next.js docs
 * are explicit that Proxy is for optimistic checks only. getUser() revalidates
 * the token against the auth server rather than trusting a cookie's contents.
 *
 * It is still not the last line of defence: even if this check were removed,
 * Row Level Security would return nothing. Three layers, and the database one
 * cannot be bypassed by a frontend mistake — which is precisely what went wrong
 * in the original, where a CSS class was the only thing hiding the data.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth?next=/app");
  }

  // Both data tiers require a confirmed address, so an unconfirmed account
  // would otherwise reach an app that renders nothing with no explanation.
  if (!user.email_confirmed_at) {
    redirect("/auth?unconfirmed=1");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <Link href="/app" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="MeritNama"
            width={160}
            height={40}
            className="h-8 w-auto object-contain"
            priority
          />
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-xs text-fg-muted sm:inline">
            {user.email}
          </span>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
