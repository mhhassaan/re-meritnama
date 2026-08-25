import "server-only";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { signAvatars } from "@/lib/profile/avatar";

/**
 * Community Profiles.
 *
 * The original's framing: "Browse registered members who have shared their
 * profile. Data is self-reported and shown publicly by the user."
 *
 * ## No new policy — and that is the point of how `profiles` was written
 *
 * `profiles_select` has always been `own OR is_public OR staff`. A directory
 * of people who opted in needs nothing added; the table was designed for this
 * from the start. Compare the Candidate Pool roster, which needed a whole new
 * table and an explicit owner decision, because nobody in it opted into
 * anything.
 *
 * ## What a card may show is fixed by a promise already on screen
 *
 * `/app/profile` tells anyone ticking the discoverability box, in those words:
 * *"other verified candidates can see your display name and your two goals —
 * and nothing else. Your email, your marks, your preferences and your
 * applicant id are never part of it."*
 *
 * The original's cards carry more than that — a merit band ("Top 50%"),
 * inducted status, and programme tags. Every one of those is derived from
 * marks or from the preference list, which is precisely what that sentence
 * rules out. Adding any of them here would make this app's own consent copy
 * false retroactively, for people who ticked the box under the old wording.
 * So the card is three fields, and the page says so.
 *
 * ## Why the private-profile count is missing
 *
 * The original prints "66 members have a profile but have set it to private."
 * It can, because its rules let the browser read every row. Ours cannot: RLS
 * hides private rows from the caller, so counting them would mean a
 * service-role read to produce a cosmetic line. Not worth bypassing the policy
 * for, so the page states the rule instead of the number.
 */

const PAGE_SIZE = 24;

export type PublicProfile = {
  /** Stable for React keys and nothing else — never rendered. */
  key: string;
  displayName: string;
  specialtyGoal: string | null;
  hospitalGoal: string | null;
  /**
   * A short-lived signed URL, or null. The bucket is private and has no select
   * policy, so this is the only way a photo reaches a browser.
   */
  avatarUrl: string | null;
  /** The signed-in user's own card, so it can be marked rather than hidden. */
  isMe: boolean;
};

export type ProfilesView = {
  profiles: PublicProfile[];
  total: number;
  page: number;
  pageCount: number;
  /** Specialties actually present among public profiles, for the filter. */
  specialties: string[];
  /** False when the caller cannot read the table at all. */
  ok: boolean;
};

export type ProfileFilters = {
  search?: string;
  specialty?: string;
  page?: number;
};

export async function loadPublicProfiles(
  filters: ProfileFilters = {}
): Promise<ProfilesView> {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);

  const page = Math.max(1, Math.trunc(filters.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("profiles")
    .select("user_id, display_name, specialty_goal, hospital_goal, avatar_path", {
      count: "exact",
    })
    // Explicit, even though the policy would hide private rows anyway. Without
    // it the caller's own private profile comes back — `own OR is_public` — and
    // would appear in a directory they had not opted into.
    .eq("is_public", true)
    // A public profile with no name renders as a blank card. The form refuses
    // to let someone go public without one; this covers rows that predate it.
    .not("display_name", "is", null);

  const term = filters.search?.trim();
  if (term) {
    // Commas and parentheses are PostgREST's own separators inside `or`, so
    // they are stripped rather than escaped — the same treatment the Candidate
    // Pool roster's search needs.
    const safe = term.replace(/[,()]/g, " ").trim();
    query = query.or(
      `display_name.ilike.*${safe}*,specialty_goal.ilike.*${safe}*,hospital_goal.ilike.*${safe}*`
    );
  }

  if (filters.specialty) query = query.eq("specialty_goal", filters.specialty);

  const { data, error, count } = await query
    .order("display_name", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    return {
      profiles: [],
      total: 0,
      page: 1,
      pageCount: 1,
      specialties: [],
      ok: false,
    };
  }

  // Facet list read separately and unfiltered, so choosing a specialty does not
  // then remove every other specialty from the dropdown that chose it.
  const { data: facetRows } = await supabase
    .from("profiles")
    .select("specialty_goal")
    .eq("is_public", true)
    .not("specialty_goal", "is", null);

  const specialties = [
    ...new Set((facetRows ?? []).map((r) => r.specialty_goal!.trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  const total = count ?? data?.length ?? 0;

  // One batch request for the page's photos rather than one per card. A path
  // that fails to sign is absent from the map, so the card falls back to the
  // initial instead of rendering a broken image.
  const avatars = await signAvatars((data ?? []).map((row) => row.avatar_path));

  return {
    profiles: (data ?? []).map((row) => ({
      key: row.user_id,
      displayName: row.display_name!.trim(),
      specialtyGoal: row.specialty_goal?.trim() || null,
      hospitalGoal: row.hospital_goal?.trim() || null,
      avatarUrl: row.avatar_path ? (avatars.get(row.avatar_path) ?? null) : null,
      isMe: user?.id === row.user_id,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    specialties,
    ok: true,
  };
}
