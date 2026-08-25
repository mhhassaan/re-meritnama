"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { loadSeats } from "@/lib/portal/data";
import {
  AVATAR_BUCKET,
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  avatarPathFor,
} from "./avatar";

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

/**
 * Uploads the signed-in user's profile photo.
 *
 * ## What makes this safe is the storage policy, not this file
 *
 * `storage.objects` carries insert/update/delete policies for the `avatars`
 * bucket that check `(storage.foldername(name))[1] = auth.uid()`. The path is
 * built here from the session and is never a parameter — there is no field in
 * which to ask for somebody else's folder — but even if this action were wrong,
 * the database would refuse the write.
 *
 * ## Validated twice, and neither check is the real one
 *
 * Size and content type are checked here and again by the bucket's own
 * `file_size_limit` and `allowed_mime_types`. Both read the type the *client*
 * declares, so neither proves the bytes are an image. What contains that is the
 * bucket being private, never rendered as HTML, and refusing SVG — the one
 * accepted format whose difference from the others is that it can execute.
 */
export async function uploadAvatar(form: FormData): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to change your photo." };

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image first." };
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, error: "That image is over 2 MB. Choose a smaller one." };
  }

  if (!AVATAR_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG or WebP image." };
  }

  const supabase = await createClient();
  const path = avatarPathFor(user.id);

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) return { ok: false, error: uploadError.message };

  // Checked by effect, like every other write in this project: PostgREST
  // answers 204 with zero rows when a policy hides the target.
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      { user_id: user.id, avatar_path: path, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select("user_id");

  if (error) return { ok: false, error: error.message };
  if (!data?.length) {
    return { ok: false, error: "The photo uploaded but the profile did not save." };
  }

  revalidatePath("/app", "layout");
  return { ok: true };
}

/**
 * Removes the photo.
 *
 * The object is deleted as well as the column cleared. Clearing the column
 * alone would leave the file in the bucket, still signable by anything that
 * knew the path, while the person had been told their photo was gone.
 *
 * The order matters the other way round from the upload: the column is cleared
 * first, so a failure to delete the object leaves an orphan nobody can reach
 * rather than a profile pointing at a file that is no longer there.
 */
export async function removeAvatar(): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to change your photo." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_path: null, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select("user_id");

  if (error) return { ok: false, error: error.message };
  if (!data?.length) {
    return { ok: false, error: "Nothing was changed. Sign in again and retry." };
  }

  await supabase.storage.from(AVATAR_BUCKET).remove([avatarPathFor(user.id)]);

  revalidatePath("/app", "layout");
  return { ok: true };
}
