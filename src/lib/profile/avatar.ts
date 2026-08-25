import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Profile photos.
 *
 * The bucket is private and carries **no select policy**, so nothing in the
 * browser can fetch an object directly however predictable the path is. Every
 * read goes through a signed URL minted here, server-side, after the caller has
 * been through whatever gate the surface requires — see the migration for why a
 * public bucket was refused.
 *
 * ## One object per user
 *
 * `<uid>/avatar`, upserted. No extension and no timestamp in the name: a fresh
 * path per upload would leave every photo a person had ever set sitting in the
 * bucket, unreachable from the app and impossible for them to remove. The
 * content type is stored with the object, which is what the signed URL serves.
 *
 * ## The URL is short-lived on purpose
 *
 * A signed URL is a bearer token in a query string. It gets into browser
 * history, into a screenshot, into whatever a page is copied into. An hour is
 * long enough to render and to be scrolled past, short enough that a leaked one
 * is not a standing grant.
 */

export const AVATAR_BUCKET = "avatars";

/** Seconds a minted URL stays valid. */
const SIGNED_URL_TTL = 60 * 60;

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/** SVG is deliberately absent — see the migration. */
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function avatarPathFor(userId: string): string {
  return `${userId}/avatar`;
}

/** A signed URL for one stored path, or null if it cannot be minted. */
export async function signAvatar(path: string | null): Promise<string | null> {
  if (!path) return null;

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);

  return data?.signedUrl ?? null;
}

/**
 * Signed URLs for many stored paths at once, keyed by path.
 *
 * One request rather than one per card: the Community Profiles directory
 * renders 24 at a time, and 24 round trips to mint 24 URLs would put the
 * page's cost back where the performance work took it from.
 *
 * A path that fails to sign is simply absent from the map, so a card falls back
 * to the initial rather than rendering a broken image.
 */
export async function signAvatars(
  paths: (string | null)[]
): Promise<Map<string, string>> {
  const wanted = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (wanted.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrls(wanted, SIGNED_URL_TTL);

  const map = new Map<string, string>();
  for (const entry of data ?? []) {
    if (entry.path && entry.signedUrl && !entry.error) {
      map.set(entry.path, entry.signedUrl);
    }
  }
  return map;
}
