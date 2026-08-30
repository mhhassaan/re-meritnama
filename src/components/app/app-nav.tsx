"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu01Icon } from "@/components/ui/menu-01";
import {
  ICON_SIZE,
  useActionIcon,
  type AnimatedIcon,
} from "@/components/app/action-icon";
import { ArrowLeft02Icon } from "@/components/ui/arrow-left-02";
import { NavPending } from "@/components/app/nav-pending";
import { Archive02Icon } from "@/components/ui/archive-02";
import { Calendar03Icon } from "@/components/ui/calendar-03";
import { ClipboardIcon } from "@/components/ui/clipboard";
import { CompassIcon } from "@/components/ui/compass";
import { CrownIcon } from "@/components/ui/crown";
import { DashboardSquare01Icon } from "@/components/ui/dashboard-square-01";
import { DatabaseIcon } from "@/components/ui/database";
import { File01Icon } from "@/components/ui/file-01";
import { GridViewIcon } from "@/components/ui/grid-view";
import { HelpCircleIcon } from "@/components/ui/help-circle";
import { SparklesIcon } from "@/components/ui/sparkles";
import { HistoryIcon } from "@/components/ui/history";
import { ListViewIcon } from "@/components/ui/list-view";
import { Location01Icon } from "@/components/ui/location-01";
import { Login01Icon } from "@/components/ui/login-01";
import { Message01Icon } from "@/components/ui/message-01";
import { RedoIcon } from "@/components/ui/redo";
import { Settings01Icon } from "@/components/ui/settings-01";
import { Shield02Icon } from "@/components/ui/shield-02";
import { SlidersHorizontalIcon } from "@/components/ui/sliders-horizontal";
import { Target01Icon } from "@/components/ui/target-01";
import { UserIcon } from "@/components/ui/user";
import { UserCheck01Icon } from "@/components/ui/user-check-01";
import { UserGroupIcon } from "@/components/ui/user-group";

/**
 * Navigation, in the groups the original uses.
 *
 * There are TWO navigations, because the original has two applications. The
 * historical-data app (`app.html`) analyses past cycles; the Induction Portal
 * (`simulation.html`) works the cycle that is open now, and it replaces the nav
 * entirely rather than adding tabs to it — its own four groups, and a "back"
 * link out. That separation is deliberate on the original's part and worth
 * keeping: the portal's questions are about live seats and the analysis app's
 * are about closed cycles, and mixing them into one list of fourteen items
 * loses the distinction.
 *
 * Which set is shown is decided by the path. Everything under `/app/portal`
 * gets the portal nav.
 *
 * Destinations that do not exist yet are listed rather than hidden, in both
 * sets. Someone arriving from the original expects Consent What-If and the
 * Candidate Pool, and a nav that silently omits them reads as "this rebuild
 * lost features" rather than "not yet".
 */

/**
 * The nav icons are `@hugeicons-animated` components.
 *
 * Two things about them shape the markup below.
 *
 * They render a **`<div>`**, not an `<svg>`. A div inside a `<span>` is invalid
 * HTML and throws a hydration error, which is why the "Soon" row below is a div
 * — it was a span while these were plain SVGs.
 *
 * And they play on hover of **their own** element, which in a nav row is an
 * 18px target inside a full-width link. Passing a ref switches the component to
 * parent control — `useIconAnimation` sets `isControlledRef` the moment the
 * handle is attached — so the row drives the icon and hovering anywhere along
 * it plays.
 *
 * `prefers-reduced-motion` is handled inside the shared hook, so nothing here
 * needs to guard it.
 */
type NavItem = {
  label: string;
  href: string | null;
  Icon: AnimatedIcon;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Analyze",
    items: [
      { label: "Start Here", href: "/app/start", Icon: CompassIcon },
      { label: "Merit Table", href: "/app/merit", Icon: ListViewIcon },
      { label: "My Prediction", href: "/app/prediction", Icon: Target01Icon },
      { label: "Calculator", href: "/app/calculator", Icon: SlidersHorizontalIcon },
      { label: "Compare", href: "/app/compare", Icon: GridViewIcon },
      { label: "Previous Merit Lists", href: "/app/merit-lists", Icon: Archive02Icon },
    ],
  },
  {
    label: "Tools",
    items: [
      // One door into the portal, not a flattened list of its tabs. The portal
      // is a second application and swaps this nav for its own.
      { label: "Induction Portal", href: "/app/portal", Icon: Login01Icon },
      { label: "Accreditation", href: "/app/accreditation", Icon: Shield02Icon },
      { label: "Jobs", href: "/app/jobs", Icon: ClipboardIcon },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "Editorial", href: "/app/editorial", Icon: File01Icon },
      { label: "Policy", href: "/app/policy", Icon: File01Icon },
      { label: "Guide", href: "/app/guide", Icon: HelpCircleIcon },
      { label: "Support", href: "/app/support", Icon: SparklesIcon },
      { label: "Discussion", href: "/app/discussion", Icon: Message01Icon },
      { label: "Community Feed", href: "/app/community", Icon: UserGroupIcon },
    ],
  },
];

/**
 * The Induction Portal's own navigation.
 *
 * Taken from the DEPLOYED portal, not from `simulation.html` in this repo. That
 * file is older and lists a "Guide" tab plus "Where Merit Falls" and "Seat
 * Allocation"; the live portal opens on Overview and is organised around the
 * published Merit List with a consent overlay. Building from the local copy
 * produced a nav the original does not have — the second time a stale local
 * file has nearly shipped the wrong thing.
 *
 * Where Merit Falls, Seat Allocation and Consent What-If sit AFTER Config
 * rather than interleaved with the original's five, so those five stay in the
 * original's order and this trio reads as additions rather than as part of
 * the portal's own sequence — a mistake an earlier version made once already.
 * All three are hidden on the live site right now by its own
 * `applyMode('merit-list')`, which switches off once a merit list has
 * published for the cycle; built here anyway, on the same reasoning each
 * time: the pane and its script both still ship, and the feature is the live
 * experience in the phase of a cycle where that gate has not yet fired.
 */
export const PORTAL_NAV_GROUPS: NavGroup[] = [
  {
    label: "Start",
    items: [
      { label: "Overview", href: "/app/portal", Icon: DashboardSquare01Icon },
      { label: "Candidate Pool", href: "/app/portal/pool", Icon: UserGroupIcon },
      { label: "Merit List", href: "/app/portal/merit-list", Icon: ListViewIcon },
      { label: "Joining Status", href: "/app/portal/joining", Icon: UserCheck01Icon },
      { label: "Config", href: "/app/portal/config", Icon: Settings01Icon },
      { label: "Where Merit Falls", href: "/app/portal/slots", Icon: Target01Icon },
      { label: "Seat Allocation", href: "/app/portal/allocation", Icon: GridViewIcon },
      { label: "Consent What-If", href: "/app/portal/consent", Icon: RedoIcon },
    ],
  },
  {
    label: "Plan",
    items: [
      { label: "Schedule", href: "/app/portal/schedule", Icon: Calendar03Icon },
      { label: "Hospitals", href: "/app/portal/hospitals", Icon: Location01Icon },
      { label: "Profiles", href: "/app/portal/profiles", Icon: UserIcon },
      { label: "Chat", href: "/app/portal/chat", Icon: Message01Icon },
    ],
  },
  {
    label: "More",
    items: [
      { label: "Competition", href: "/app/portal/competition", Icon: CrownIcon },
      { label: "Training Seats", href: "/app/portal/seats", Icon: DatabaseIcon },
      { label: "Accreditation", href: "/app/accreditation", Icon: Shield02Icon },
      { label: "Data Changes", href: "/app/portal/changes", Icon: HistoryIcon },
    ],
  },
];

/**
 * One row of the rail.
 *
 * The icon is held in a fixed `ICON_SIZE` box so every label starts at the same
 * x, and the row — not the icon — owns the hover, so the whole target plays the
 * animation rather than the 18 pixels of artwork.
 *
 * A row with no destination is a `<div>`, not a `<span>`: the icons render a
 * div, and a div inside a span is invalid HTML that fails hydration. It is
 * still neither a link nor a button, because there is nothing to activate and
 * it must not be focusable or announced as somewhere you can go.
 */
function NavRow({
  item: { label, href, Icon },
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const { ref: icon, handlers } = useActionIcon();

  if (href == null) {
    return (
      <li>
        <div
          aria-disabled
          className="flex cursor-default items-center gap-3 rounded-sm px-3 py-2 text-sm text-fg-subtle/70"
        >
          <Icon size={ICON_SIZE} className="shrink-0 opacity-60" />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <span className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider">
            Soon
          </span>
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        {...handlers}
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors duration-[150ms] ${
          active
            ? "bg-accent-quiet font-bold text-accent"
            : "text-fg-muted hover:bg-surface-sunken hover:text-foreground"
        }`}
      >
        <Icon ref={icon} size={ICON_SIZE} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <NavPending />
      </Link>
    </li>
  );
}

/** The portal's way out, with the arrow animating on the whole row. */
function BackLink({ onNavigate }: { onNavigate?: () => void }) {
  const { ref: icon, handlers } = useActionIcon();

  return (
    <Link
      href="/app/start"
      onClick={onNavigate}
      {...handlers}
      className="flex items-center gap-3 rounded-sm px-3 py-2 text-sm text-fg-muted transition-colors duration-[150ms] hover:bg-surface-sunken hover:text-foreground"
    >
      <ArrowLeft02Icon ref={icon} size={ICON_SIZE} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">Historical Data</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  // The portal replaces this nav rather than extending it — see the note above
  // `NAV_GROUPS`.
  const inPortal = pathname.startsWith("/app/portal");
  const groups = inPortal ? PORTAL_NAV_GROUPS : NAV_GROUPS;

  return (
    <nav
      aria-label={inPortal ? "Induction Portal sections" : "Sections"}
      className="flex flex-col gap-7 py-6"
    >
      {inPortal && (
        // The original's "← Historical Data". Without a way back, the portal is
        // a place you fall into, and its nav shows none of the analysis pages.
        <div className="px-2">
          <BackLink onNavigate={onNavigate} />
        </div>
      )}

      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-4 pb-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-fg-subtle">
            {group.label}
          </p>

          <ul className="flex flex-col gap-0.5 px-2">
            {group.items.map((item) => (
              <NavRow
                key={item.label}
                item={item}
                active={item.href != null && pathname === item.href}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** Persistent rail, from `lg` up. */
export function AppSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface-sunken/40 lg:block">
      {/* `top-16` matches the app header's fixed height, so the rail pins just
          below it rather than sliding underneath. */}
      <div className="sticky top-16 max-h-[calc(100dvh-4rem)] overflow-y-auto">
        <NavList />
      </div>
    </aside>
  );
}

/**
 * The same nav as a drawer, below `lg`.
 *
 * A drawer rather than a bottom tab bar for now: there are fourteen
 * destinations in three named groups, and flattening that into five tabs would
 * mean inventing a hierarchy the original does not have.
 */
export function AppNavDrawer() {
  const [open, setOpen] = useState(false);
  const { ref: icon, handlers } = useActionIcon();
  const pathname = usePathname();

  // Route changes close it. Without this, tapping a destination leaves the
  // drawer covering the page you just asked for.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
        aria-expanded={open}
        {...handlers}
        className="flex h-10 w-10 items-center justify-center rounded-sm border border-border-strong text-fg-muted transition-colors hover:text-foreground lg:hidden"
      >
        <Menu01Icon ref={icon} size={ICON_SIZE} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-brand-midnight/50 backdrop-blur-sm motion-safe:animate-[fadeIn_250ms_cubic-bezier(0.32,0.72,0,1)]"
          />

          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-border bg-surface shadow-lifted motion-safe:animate-[drawerIn_350ms_cubic-bezier(0.32,0.72,0,1)]">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
