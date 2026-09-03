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

