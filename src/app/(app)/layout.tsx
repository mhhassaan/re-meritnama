import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { UserMenu } from "@/components/app/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { signAvatar } from "@/lib/profile/avatar";
import { loadLiveNotices } from "@/lib/announce/data";
import { NoticeBanner } from "@/components/app/notice-banner";
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
  const notices = await loadLiveNotices();
  const [{ data: profile }, { data: roles }] = await Promise.all([
    // Filtered to this user on purpose: `profiles` is readable for every
    // public profile, so an unfiltered `.maybeSingle()` matches several rows
    // and errors out — the header would silently fall back to the email.
    supabase
      .from("profiles")
      .select("display_name, avatar_path")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role"),
  ]);

  const displayName = profile?.display_name?.trim() || null;
  // The bucket is private with no select policy, so the header's own photo
  // needs a signed URL like every other read of it.
  const avatarUrl = await signAvatar(profile?.avatar_path ?? null);
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

        {/* Theme and sign out sit in the header rather than inside the account
            menu. Both are one-tap things people reach for often — switching
            theme because the room changed, signing out on a shared machine —
            and a control you use that often should not be two gestures deep.
            The menu keeps what is genuinely about the account: who you are,
            your profile, and the staff surfaces.

            Below `sm` that argument loses to arithmetic: the theme control is
            three 32px buttons in a row, and with the nav trigger, the logo and
            the account menu already in the row there is no space left for it.
            It moves inside the menu at that width only — see `UserMenu` — and
            sign out keeps its place with the label dropped. */}
        <div className="flex items-center gap-2 sm:gap-3">
          <UserMenu
            identity={{
              email: user.email ?? "",
              displayName,
              initial,
              avatarUrl,
              isStaff: Boolean(roles?.length),
            }}
          />
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>
          <SignOutButton />
        </div>
      </header>

      {/* Announcements sit under the header and above the rail, so they are the
          first thing on every page without displacing the nav. */}
      <NoticeBanner notices={notices} />

      {/* The rail scrolls with its own sticky container rather than the page,
          so the nav stays reachable down a 1,470-row table. */}
      <div className="flex flex-1">
        <AppSidebar />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
