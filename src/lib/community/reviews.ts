import "server-only";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { Author, Moderation } from "./data";

/**
 * Training reviews for one hospital.
 *
 * The original's hospital profile ends with these: an overall rating, three
 * optional aspects, the year the reviewer trained, and an optional specialty.
 *
 * They are `community_posts` with `kind = 'hospital_review'`, not a table of
 * their own — so a review is written through the same authorship trigger,
 * counted by the same rate limit, reported through the same button and hidden
 * by the same moderation queue as everything else a person writes here. That is
 * why this file is short: none of the hard parts belong to reviews.
 *
 * Read **as the caller**, uncached. A hidden review is visible to its author and
 * to staff and to nobody else, so a shared cache would hand one reader's view to
 * another.
 */

export type Review = {
  id: number;
  title: string;
  body: string;
  specialty: string | null;
  rating: number | null;
  teaching: number | null;
  balance: number | null;
  seniors: number | null;
  trainingYear: number | null;
  createdAt: string;
  author: Author;
  moderation: Moderation;
};

export type ReviewSummary = {
  count: number;
  /** Null until somebody has rated, rather than 0 — see below. */
  overall: number | null;
  teaching: number | null;
  balance: number | null;
  seniors: number | null;
  /** How many gave each overall score, 5 down to 1. */
  distribution: { score: number; count: number }[];
};

export type HospitalReviews = {
  reviews: Review[];
  summary: ReviewSummary;
  /** True when the reader has already written one for this hospital. */
  mine: boolean;
};

/**
 * Mean of the values that exist, or null when none do.
 *
 * Null rather than 0 deliberately. Zero is a rating, and the aspects are
 * optional — a hospital nobody scored for teaching would otherwise show
 * "0.0 teaching", which reads as the worst possible score rather than as an
 * absent one. The same distinction the data-changes work turned on.
 */
function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}

export async function loadHospitalReviews(
  hospital: string
): Promise<HospitalReviews> {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);

  const { data } = await supabase
    .from("community_posts")
    .select("*")
    .eq("kind", "hospital_review")
    .eq("hospital", hospital)
    .order("created_at", { ascending: false });

  const rows = data ?? [];

  const reviews: Review[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    specialty: row.specialty,
    rating: row.rating,
    teaching: row.rating_teaching,
    balance: row.rating_balance,
    seniors: row.rating_seniors,
    trainingYear: row.training_year,
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      name: row.author_name,
      isMe: user?.id === row.author_id,
    },
    moderation: {
      hidden: Boolean(row.hidden_at),
      reason: row.hidden_reason,
    },
  }));

  // Averages are computed over the VISIBLE reviews only. A hidden one is still
  // returned to its author by the policy, and letting it move the number would
  // show that author a different average from everybody else — and would let a
  // removed review keep influencing the score it was removed for.
  const counted = reviews.filter((r) => !r.moderation.hidden);

  const distribution = [5, 4, 3, 2, 1].map((score) => ({
    score,
    count: counted.filter((r) => r.rating === score).length,
  }));

  return {
    reviews,
    summary: {
      count: counted.length,
      overall: mean(counted.map((r) => r.rating)),
      teaching: mean(counted.map((r) => r.teaching)),
      balance: mean(counted.map((r) => r.balance)),
      seniors: mean(counted.map((r) => r.seniors)),
      distribution,
    },
    mine: reviews.some((r) => r.author.isMe),
  };
}

/**
 * Average rating and review count for every hospital that has one, keyed by
 * hospital name.
 *
 * One query for the whole directory rather than one per card — 69 cards would
 * otherwise be 69 round trips, which is the mistake the portal's performance
 * work exists to have fixed once.
 *
 * Hidden reviews are excluded here by the `.is("hidden_at", null)` filter
 * rather than in JavaScript. The select policy still returns a reader their own
 * hidden review, so filtering after the fact would show its author a different
 * average from everybody else.
 */
export async function loadHospitalRatings(): Promise<
  Map<string, { average: number; count: number }>
> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("community_posts")
    .select("hospital, rating")
    .eq("kind", "hospital_review")
    .is("hidden_at", null)
    .not("hospital", "is", null)
    .not("rating", "is", null);

  const totals = new Map<string, { sum: number; count: number }>();
  for (const row of data ?? []) {
    if (!row.hospital || row.rating == null) continue;
    const entry = totals.get(row.hospital) ?? { sum: 0, count: 0 };
    entry.sum += row.rating;
    entry.count += 1;
    totals.set(row.hospital, entry);
  }

  return new Map(
    [...totals.entries()].map(([hospital, { sum, count }]) => [
      hospital,
      { average: sum / count, count },
    ])
  );
}
