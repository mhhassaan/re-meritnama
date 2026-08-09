import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/server";
import { getCurrentRole, isStaffRole } from "@/lib/auth/roles";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";

/**
 * Staff console shell.
 *
 * Returns 404 rather than "forbidden" so the response carries no data. Note it
 * does NOT hide the route's existence: calling notFound() in a layout sets the
 * status but does not prevent child pages rendering, and their output still
 * appears in the 404 body — page titles included. Treat the route as
 * discoverable and rely on the checks below, not on obscurity.
 *
 * Because of that, the same role check is repeated in each page rather than
 * assumed from this layout. And neither is the last line of defence: every
 * table the console reads is guarded by RLS keyed on the same role, so removing
 * these checks would change what renders, not what the database returns.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) notFound();

  const role = await getCurrentRole();
  if (!isStaffRole(role)) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="font-mono text-[11px] font-bold uppercase tracking-[0.3em] text-accent"
          >
            MeritNama Staff
          </Link>
          <span className="rounded-sm border border-border-strong px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted">
            {role}
          </span>
        </div>

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
