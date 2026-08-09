/**
 * Literal brand colour values.
 *
 * Tailwind classes cannot reach canvas, WebGL, or any other API that needs a
 * real colour string at runtime, so those call sites read from here instead of
 * inlining a hex value. Keep these in sync with the `--brand-*` tokens in
 * `globals.css` — that file stays the design authority; this is the escape
 * hatch for code the CSS layer cannot reach.
 */
export const BRAND = {
  cream: "#FAF9F5",
  creamDeep: "#F3F0E6",
  midnight: "#0F2825",
  midnightDeep: "#0B1E1C",
  midnightRaised: "#143733",
  midnightAbyss: "#081312",
  teal: "#0D9488",
  tealDeep: "#115E59",
  tealDeeper: "#134E4A",
  mint: "#2DD4BF",
  ivory: "#E8E0CA",
  ink: "#171717",
  inkMuted: "#737373",
  mist: "#A8B8B5",
} as const;
