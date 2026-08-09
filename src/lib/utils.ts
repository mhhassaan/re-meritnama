import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Conditional class names with Tailwind conflict resolution.
 *
 * Required by shadcn-registry components (including the `@bklit` charts), which
 * import it from the `utils` alias in `components.json`. Application code that
 * is not registry-derived should keep using plain template strings — this is
 * here for compatibility, not as a house style.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
