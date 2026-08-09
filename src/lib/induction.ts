/**
 * The induction cycle the application currently operates on.
 *
 * The PHF portal reissues applicant IDs every cycle, and the same number
 * belongs to a different person each time — verified against the real archives,
 * where inductions 20 and 21 share 144 applicant IDs and none of them is the
 * same doctor.
 *
 * Consequently an applicant ID is meaningless on its own. Every lookup that
 * takes one from a user must pair it with an induction, which is why this
 * constant exists rather than the number being written inline at each call site.
 *
 * When Induction 22 opens this changes, and returning candidates must re-verify
 * to link their account to their new record — their previous link stays valid
 * for the previous cycle.
 */
export const CURRENT_INDUCTION = 21;
