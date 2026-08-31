"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Logout01Icon } from "@/components/ui/logout-01";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const { ref: icon, handlers } = useActionIcon();

  const signOut = async () => {
    setPending(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // Full navigation rather than a router push, so the server drops the
    // now-cleared auth cookies and no stale authenticated markup is reused.
    window.location.assign("/auth");
  };

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      {...handlers}
      // The label is dropped below `sm`, where the header has the nav trigger,
      // the logo, the account menu and this button competing for about 360
      // pixels. The icon carries it, and `aria-label` carries the icon — an
      // icon-only control with no accessible name is a button that only sighted
      // pointer users can identify.
      aria-label={pending ? "Signing out" : "Sign out"}
      title="Sign out"
      className="flex min-h-[36px] items-center gap-2 rounded-sm border border-border-strong px-2.5 py-1.5 text-xs font-semibold text-fg-muted transition-colors hover:text-foreground disabled:opacity-60 sm:px-3"
    >
      <Logout01Icon ref={icon} size={ICON_SIZE_SM} />
      <span className="hidden sm:inline">
        {pending ? "Signing out…" : "Sign out"}
      </span>
    </button>
  );
}
