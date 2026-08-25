import "server-only";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { loadSeats } from "@/lib/portal/data";
import { signAvatar } from "./avatar";

/**
 * The signed-in user's own profile.
 *
 * ## Two different records, and the difference is the whole point
 *
 * `candidates` is the **gazette's** record of a person: name, marks,
 * preferences, verification. It is written by the ingest pipeline and nobody
 * can edit it here — that is what makes it worth anything.
 *
 * `profiles` is what the user says about themselves: a display name, what they
 * are aiming for, and whether they want to be discoverable. Self-asserted,
 * self-editable, and never mixed into the first. The original's My Profile page
 * runs the two together under one heading; keeping them visibly separate is the
 * only way a reader can tell which is which.
 *
 * The link between them is `candidate_links`, written server-side only after
 * a credential reaches the address already on the candidate record. This page
 * **reports** that link and cannot create one.
 */

export type MyProfile = {
  email: string;
  displayName: string | null;
  specialtyGoal: string | null;
  hospitalGoal: string | null;
  isPublic: boolean;
  /** A short-lived signed URL, or null when there is no photo. */
  avatarUrl: string | null;
  /** True once a profile row exists at all — the form inserts on first save. */
  exists: boolean;
};

export type LinkedRecord = {
  applicantId: number;
  induction: number;
  nameFull: string;
  /** The portal's verification status, or null when it has no record. */
  profileStatus: number | null;
} | null;

export type ProfileView = {
  profile: MyProfile;
  linked: LinkedRecord;
  facets: { specialties: string[]; hospitals: string[] };
};

export async function loadMyProfile(): Promise<ProfileView | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();

  const [{ data: row }, { data: candidate }, seats] = await Promise.all([
    // `.eq("user_id", …)` is not belt and braces here, it is required.
    // `profiles_select` is `own OR is_public OR staff`, so a bare
    // `.maybeSingle()` sees every public profile, finds more than one row and
    // returns an error — which reads as "you have no profile". `candidates`
    // needs no such filter because its policy resolves to one row by
    // construction; this table is deliberately readable more widely.
    supabase
      .from("profiles")
      .select("display_name, specialty_goal, hospital_goal, is_public, avatar_path")
      .eq("user_id", user.id)
      .maybeSingle(),
    // No applicant id passed from the client: the policy resolves the row
    // through `candidate_links`, so this returns the caller's own or nothing.
    supabase
      .from("candidates")
      .select("applicant_id, induction, name_full, profile_status")
      .maybeSingle(),
    loadSeats(),
  ]);

  // Goals are chosen from the real seat matrix rather than typed free. A
  // hospital that trains nothing cannot be aimed at, and a typo would quietly
  // exclude the profile from any future discovery that matches on these.
  const specialties = [...new Set(seats.map((s) => s.specialty.trim()))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const hospitals = [...new Set(seats.map((s) => s.hospital.trim()))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  // Minted after the row is read rather than alongside it: there is nothing to
  // sign until the stored path is known, and a profile with no photo makes no
  // storage request at all.
  const avatarUrl = await signAvatar(row?.avatar_path ?? null);

  return {
    profile: {
      email: user.email ?? "",
      displayName: row?.display_name ?? null,
      specialtyGoal: row?.specialty_goal ?? null,
      hospitalGoal: row?.hospital_goal ?? null,
      isPublic: row?.is_public ?? false,
      avatarUrl,
      exists: Boolean(row),
    },
    linked: candidate
      ? {
          applicantId: candidate.applicant_id,
          induction: candidate.induction,
          nameFull: candidate.name_full,
          profileStatus: candidate.profile_status,
        }
      : null,
    facets: { specialties, hospitals },
  };
}

export type Essential = {
  id: string;
  label: string;
  done: boolean;
  /** Whether the user can do it here, or it happens somewhere else. */
  actionable: boolean;
  note: string;
};

/**
 * The original's "profile strength" checklist, restricted to things that are
 * true or false about data we hold.
 *
 * Its version has six items, one of which is an "inducted status" flag. That
 * one is not here: inducted status comes from the joining export rather than
 * being something a person asserts, so listing it would score someone against a
 * control that is not on the page. A photo is now a real item, because there is
 * now a control for it.
 */
export function essentials(view: ProfileView): Essential[] {
  return [
    {
      id: "name",
      label: "Add a display name",
      done: Boolean(view.profile.displayName?.trim()),
      actionable: true,
      note: "What other candidates would see if you make your profile public.",
    },
    {
      id: "photo",
      label: "Add a profile photo",
      done: Boolean(view.profile.avatarUrl),
      actionable: true,
      note: "Stored privately and never served at a public address. Other candidates see it only if you turn discoverability on.",
    },
    {
      id: "specialty",
      label: "Set an aspiring specialty",
      done: Boolean(view.profile.specialtyGoal),
      actionable: true,
      note: "Chosen from the specialties that actually have seats this cycle.",
    },
    {
      id: "hospital",
      label: "Set an aspiring hospital",
      done: Boolean(view.profile.hospitalGoal),
      actionable: true,
      note: "Optional, and narrower than a specialty — leave it if you are open.",
    },
    {
      id: "linked",
      label: "Link your Induction Portal record",
      done: view.linked != null,
      actionable: false,
      note: "Done by verification, not here: a link is only written after a single-use link reaches the address already on your candidate record.",
    },
    {
      id: "public",
      label: "Make your profile discoverable",
      done: view.profile.isPublic,
      actionable: true,
      note: "Off by default. Nothing about you is visible to other candidates until you turn this on.",
    },
  ];
}
