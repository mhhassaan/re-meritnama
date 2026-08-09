/**
 * Two meaning-bearing color systems that must stay consistent everywhere they
 * appear, or the distinction they encode fails.
 *
 * See the `--status-*` and `--sim-*` tokens in globals.css.
 */

/**
 * Placement likelihood. `reach` is intentionally warm, not red — a reach is
 * aspirational, not an error. Red (`status-danger`) is reserved exclusively
 * for destructive actions and true failures, and appears nowhere else.
 */
export type Likelihood = "safe" | "target" | "reach";

export const LIKELIHOOD_LABELS: Record<Likelihood, string> = {
  safe: "Safe",
  target: "Target",
  reach: "Reach",
};

export const LIKELIHOOD_CLASSES: Record<
  Likelihood,
  { text: string; bg: string; border: string }
> = {
  safe: {
    text: "text-status-safe",
    bg: "bg-status-safe-quiet",
    border: "border-status-safe",
  },
  target: {
    text: "text-status-target",
    bg: "bg-status-target-quiet",
    border: "border-status-target",
  },
  reach: {
    text: "text-status-reach",
    bg: "bg-status-reach-quiet",
    border: "border-status-reach",
  },
};

/**
 * Simulation confidence register.
 *
 * `cascade` is the multi-round, consent-aware engine checked against real
 * Round 2 placements. `estimate` is the single-pass allocator with no consent
 * or round modeling. They carry genuinely different confidence, so they must
 * never render identically — a candidate reading results under stress must not
 * mistake a quick estimate for the verified run.
 *
 * This holds in the analytics UI, the flagship features, AND pinned profile
 * cards. A single surface that renders both the same way undermines the whole
 * convention.
 */
export type SimRegister = "cascade" | "estimate";

export const SIM_REGISTER_LABELS: Record<SimRegister, string> = {
  cascade: "Verified cascade",
  estimate: "Quick estimate",
};

export const SIM_REGISTER_CLASSES: Record<
  SimRegister,
  { text: string; bg: string; border: string }
> = {
  cascade: {
    text: "text-sim-cascade",
    bg: "bg-sim-cascade-quiet",
    // Solid border: this is the round-accurate result.
    border: "border-sim-cascade border-solid",
  },
  estimate: {
    text: "text-sim-estimate",
    bg: "bg-sim-estimate-quiet",
    // Dashed border: a visual, not merely textual, marker that this is an
    // estimate — copy alone is too easy to skip past.
    border: "border-sim-estimate border-dashed",
  },
};