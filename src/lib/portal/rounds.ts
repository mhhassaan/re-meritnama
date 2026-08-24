/**
 * The last published round of the current cycle.
 *
 * Joining Status compares the export against the round that actually allocated
 * the seats, so it needs to know which one that is. Hardcoded rather than
 * derived from `max(round)`: a round appearing in the database mid-ingest would
 * otherwise silently change what "the final round" means, and the comparison is
 * the whole basis of the "no candidate selected" figure.
 */
export const FINAL_ROUND = 8;
