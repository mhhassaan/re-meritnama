"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);

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
      className="flex min-h-[36px] items-center gap-2 rounded-sm border border-border-strong px-3 py-1.5 text-xs font-semibold text-fg-muted transition-colors hover:text-foreground disabled:opacity-60"
    >
      <LogOut className="h-3.5 w-3.5" />
      <span>{pending ? "Signing out…" : "Sign out"}</span>
    </button>
  );
}
