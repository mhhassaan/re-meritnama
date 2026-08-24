import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { UserMenu } from "@/components/app/user-menu";
import { AppNavDrawer, AppSidebar } from "@/components/app/app-nav";

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

  // The account menu's contents, resolved server-side. Both reads are the
  // caller's own row under policies that already exist — `profiles` is
  // self-readable and `user_roles` has no client write policy at all, so a role
  // shown here cannot be one the holder granted themselves.
  const supabase = await createClient();
  const [{ data: profile }, { data: roles }] = await Promise.all([
    // Filtered to this user on purpose: `profiles` is readable for every
    // public profile, so an unfiltered `.maybeSingle()` matches several rows
    // and errors out — the header would silently fall back to the email.
    supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role"),
  ]);

  const displayName = profile?.display_name?.trim() || null;
  const initial = (displayName || user.email || "?").trim().charAt(0) || "?";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Fixed height, not padding-derived: the sidebar offsets itself by this
          exact value, and a header that changes height would leave the rail
          either overlapped or floating. */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {/* The nav trigger sits before the logo, where a back control would
              be — the position a thumb reaches for on a phone. */}
          <AppNavDrawer />

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
        </div>

        <UserMenu
          identity={{
            email: user.email ?? "",
            displayName,
            initial,
            isStaff: Boolean(roles?.length),
          }}
        />
      </header>

      {/* The rail scrolls with its own sticky container rather than the page,
          so the nav stays reachable down a 1,470-row table. */}
      <div className="flex flex-1">
        <AppSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
