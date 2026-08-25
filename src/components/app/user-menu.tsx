"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserIcon } from "@/components/ui/user";
import { Settings01Icon } from "@/components/ui/settings-01";
import { Shield02Icon } from "@/components/ui/shield-02";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * The account menu in the app header.
 *
 * It replaces three things that were sitting loose in the header — the email
 * address, the theme control and the sign-out button — because they are all
 * answers to "this is me, and here is what I can change about that", and a
 * header row of unrelated controls is where a product starts to look assembled
 * rather than designed.
 *
 * The original's header carries a "My Profile" link, a logout button and an
 * inbox badge. Same idea, one door.
 *
 * ## Closing it
 *
 * Three ways out, because a menu that traps you is worse than no menu:
 * pointer-down outside, Escape, and a route change. The route case matters most
 * here — every item is a `Link`, and without it the menu would still be open
 * over the page it just navigated to.
 */

type Identity = {
  email: string;
  displayName: string | null;
  /** Present once a profile row exists; the fallback is the email's initial. */
  initial: string;
  /** A short-lived signed URL, or null when no photo has been uploaded. */
  avatarUrl: string | null;
  isStaff: boolean;
};

export function UserMenu({ identity }: { identity: Identity }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const root = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const trigger = useActionIcon();
  const profileIcon = useActionIcon();

  // A route change closes it. Every item is a link, so without this the menu
  // hangs over the page it just opened.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;

    // `pointerdown`, not `click`: a click listener fires after the button's own
    // handler has already toggled the menu back open, so the menu never shuts.
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = identity.displayName?.trim() || identity.email.split("@")[0];

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        {...trigger.handlers}
        className="flex min-h-[36px] items-center gap-2 rounded-sm border border-border-strong py-1 pl-1 pr-2 text-xs font-semibold text-fg-muted transition-colors hover:border-accent hover:text-foreground"
      >
        <Avatar initial={identity.initial} url={identity.avatarUrl} />
        <span className="hidden max-w-[10rem] truncate sm:inline">{name}</span>
        <ChevronDownIcon
          ref={trigger.ref}
          size={14}
          className={`transition-transform duration-[200ms] ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-40 mt-2 w-72 rounded-lg bg-surface-sunken p-1 shadow-lifted ring-1 ring-border"
        >
          <div className="rounded-[0.3rem] bg-surface p-4 shadow-[inset_0_1px_0_var(--edge-highlight)]">
            {/* ── Who you are ────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
              <Avatar initial={identity.initial} url={identity.avatarUrl} large />
              <div className="min-w-0">
                <p className="truncate font-sans text-sm font-bold text-foreground">
                  {name}
                </p>
                <p className="truncate font-mono text-[10px] text-fg-subtle">
                  {identity.email}
                </p>
              </div>
            </div>

            {identity.isStaff && (
              <p className="mt-3 inline-flex rounded-sm border border-accent/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-accent">
                Staff
              </p>
            )}

            {/* ── Destinations ───────────────────────────────────────── */}
            <div className="mt-4 flex flex-col gap-0.5 border-t border-border pt-3">
              <Link
                href="/app/profile"
                role="menuitem"
                {...profileIcon.handlers}
                className="flex items-center gap-2.5 rounded-sm px-2 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
              >
                <UserIcon ref={profileIcon.ref} size={ICON_SIZE_SM} />
                My profile
              </Link>

              {identity.isStaff && (
                <>
                  {/* The moderation queue is the one staff surface with work
                      waiting in it, so it gets its own row rather than sitting
                      a click deeper inside Admin. */}
                  <Link
                    href="/app/admin/reports"
                    role="menuitem"
                    className="flex items-center gap-2.5 rounded-sm px-2 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
                  >
                    <Shield02Icon size={ICON_SIZE_SM} />
                    Reports
                  </Link>
                  <Link
                    href="/admin"
                    role="menuitem"
                    className="flex items-center gap-2.5 rounded-sm px-2 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-sunken hover:text-foreground"
                  >
                    <Settings01Icon size={ICON_SIZE_SM} />
                    Admin
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The photo if there is one, the initial otherwise.
 *
 * The initial is not a placeholder waiting to be replaced — it is the honest
 * rendering for an account with no photo, and it stays that way rather than
 * showing a broken image, which would read as the app failing.
 *
 * Not `next/image`: the source is a signed URL that expires within the hour, so
 * there is nothing stable to optimise or cache, and adding a remote pattern for
 * the storage host would let any object in it be proxied through our domain.
 */
function Avatar({
  initial,
  url,
  large = false,
}: {
  initial: string;
  url?: string | null;
  large?: boolean;
}) {
  const size = large ? "h-10 w-10 text-base" : "h-6 w-6 text-[10px]";

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        aria-hidden
        className={`shrink-0 rounded-full border border-border-strong object-cover ${size}`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent-quiet font-sans font-black uppercase text-accent ${size}`}
    >
      {initial}
    </span>
  );
}
