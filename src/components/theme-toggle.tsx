"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  applyTheme,
  getServerThemeSnapshot,
  readStoredTheme,
  subscribeToTheme,
  type ThemePreference,
} from "@/lib/design/theme";

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "System", Icon: Monitor },
  { value: "dark", label: "Dark", Icon: Moon },
];

/**
 * Three-state theme control. "System" is a real option rather than an implicit
 * default, so a user can return to following their OS after making a choice.
 *
 * Not mounted on the marketing pages: those use the fixed `brand-*` tokens and
 * do not respond to the theme, so a control there would appear broken. It
 * belongs in the (app) and (admin) shells.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  // The server cannot know the stored preference. useSyncExternalStore renders
  // the server snapshot during hydration and swaps to the real value itself, so
  // the markup matches without a setState-in-effect.
  const preference = useSyncExternalStore(
    subscribeToTheme,
    readStoredTheme,
    getServerThemeSnapshot
  );

  const select = (next: ThemePreference) => {
    // applyTheme notifies subscribers, which re-renders this control.
    applyTheme(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`inline-flex items-center gap-0.5 rounded-sm border border-border bg-surface-sunken p-0.5 ${className}`}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => select(value)}
            className={`flex h-8 w-8 items-center justify-center rounded-sm transition-colors ${
              active
                ? "bg-surface text-accent shadow-sm"
                : "text-fg-subtle hover:text-fg-muted"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
