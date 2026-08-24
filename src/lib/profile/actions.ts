"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { loadSeats } from "@/lib/portal/data";

/**
 * Saves the signed-in user's own profile.
 *
 * ## What makes this safe is the policy, not this file
 *
 * `profiles` has `insert` and `update` policies checking
 * `user_id = auth.uid()`, so a caller cannot write somebody else's row however
 * this action behaves. `user_id` is taken from the session here and is never a
 * parameter — there is no field in which to ask for another user's row.
 *
 * ## Why the goals are validated against the seat matrix
 *
 * Not to stop an attack: this is the user's own row and they may put what they
 * like in it. It is so the values stay joinable. The moment a directory
 * matches "everyone aiming at Cardiology", a free-typed "cardiology " with a
 * trailing space is a profile that quietly matches nothing, and the person who
 * typed it has no way to discover that.
 */

export type SaveResult =
  | { ok: true }
  | { ok: false; error: string };

/** The longest a display name may be. Long enough for a real name, short
 *  enough that it cannot be used as a message board. */
const NAME_MAX = 60;

export async function saveProfile(input: {
  displayName: string;
  specialtyGoal: string;
  hospitalGoal: string;
  isPublic: boolean;
}): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to save your profile." };

  const displayName = input.displayName.trim();
  if (displayName.length > NAME_MAX) {
    return { ok: false, error: `Display name must be ${NAME_MAX} characters or fewer.` };
  }

  // A public profile with no name would appear in a directory as a blank row,
  // which is worse for the person than not appearing at all.
  if (input.isPublic && !displayName) {
    return {
      ok: false,
      error: "Add a display name before making your profile discoverable.",
    };
  }

  const seats = await loadSeats();
  const specialties = new Set(seats.map((s) => s.specialty.trim()));
  const hospitals = new Set(seats.map((s) => s.hospital.trim()));

  const specialtyGoal = input.specialtyGoal.trim();
  const hospitalGoal = input.hospitalGoal.trim();

  if (specialtyGoal && !specialties.has(specialtyGoal)) {
    return { ok: false, error: "That specialty is not in this cycle's seat matrix." };
  }
  if (hospitalGoal && !hospitals.has(hospitalGoal)) {
    return { ok: false, error: "That hospital is not in this cycle's seat matrix." };
  }

  const supabase = await createClient();

  // Upsert on `user_id`, which is the primary key. First save inserts, every
  // later one updates — both under policies that check the same thing.
  // `select()` so the write is checked BY EFFECT. PostgREST answers 204 with
  // zero rows affected when a policy hides the target, which is a success
  // status for a write that did nothing — a mistake this project has made
  // twice, and the reason `test:rls` asserts on rows rather than on codes.
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: displayName || null,
        specialty_goal: specialtyGoal || null,
        hospital_goal: hospitalGoal || null,
        is_public: input.isPublic,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select("user_id");

  if (error) return { ok: false, error: error.message };
  if (!data?.length) {
    return { ok: false, error: "Nothing was saved. Sign in again and retry." };
  }

  // The account menu reads `display_name`, so it has to be told. `layout`
  // scope, because the menu lives in the shell rather than on this page.
  revalidatePath("/app", "layout");

  return { ok: true };
}
