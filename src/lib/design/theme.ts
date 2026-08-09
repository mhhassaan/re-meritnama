/**
 * Theme resolution.
 *
 * Three states, matching how `globals.css` is written:
 *   - "light" / "dark": an explicit user choice, stamped as `data-theme` on
 *     <html>, which wins over the OS setting in both directions.
 *   - "system": nothing is stamped, so `prefers-color-scheme` decides.
 *
 * Only the theme-aware app surfaces respond to this. The marketing pages use
 * the fixed `brand-*` tokens and deliberately stay light in every state.
 */
export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "meritnama_theme";

/**
 * Runs before first paint, inlined into <head>, so the correct theme is on the
 * document by the time anything renders — otherwise a dark-mode user gets a
 * flash of the light theme on every navigation.
 *
 * Kept as a string because it must execute ahead of hydration, before any
 * React code has loaded. Reads storage defensively: Safari private mode throws
 * on localStorage access, and a failure here would block rendering entirely.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

export function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;

  if (preference === "system") {
    // Remove the attribute rather than setting it to "system" — the CSS keys
    // off the attribute being absent to fall through to prefers-color-scheme.
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", preference);
  }

  try {
    if (preference === "system") {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Storage unavailable (private mode, blocked cookies). The theme still
    // applies for this page view; it just will not persist.
  }

  notifyThemeChange();
}

export function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Ignore — fall through to "system".
  }
  return "system";
}

/** Fired on the same tab, since `storage` only reaches *other* tabs. */
const THEME_CHANGE_EVENT = "meritnama:themechange";

/**
 * Subscription plumbing for `useSyncExternalStore`, which is what lets a
 * component read the stored preference without a setState-in-effect: React
 * renders the server snapshot during hydration, then swaps to the client
 * snapshot on its own.
 */
export function subscribeToTheme(onChange: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The server cannot know the stored preference, so it always assumes system. */
export function getServerThemeSnapshot(): ThemePreference {
  return "system";
}

export function notifyThemeChange() {
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
