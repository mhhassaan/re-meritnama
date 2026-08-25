"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * Writes for notifications and Editorial.
 *
 * What permits any of this is `private.is_staff()` inside the policy on each
 * table. This file contains no permission check of its own — a second copy of
 * the rule is a second place for it to drift — and every write is checked **by
 * effect**, because PostgREST answers 204 with zero rows when a policy hides
 * the target.
 */

export type Result = { ok: true; id?: number; slug?: string } | { ok: false; error: string };

const clean = (v: string | null | undefined, max: number) => {
  const t = (v ?? "").trim();
  return t ? t.slice(0, max) : null;
};

// ── Notifications ───────────────────────────────────────────────────────

export async function saveNotice(input: {
  id?: number;
  title: string;
  body: string;
  icon?: string;
  kind: string;
  link?: string;
  linkText?: string;
  dismissable: boolean;
  active: boolean;
  endsAt?: string;
}): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { ok: false, error: "A title and a body are both needed." };

  const link = clean(input.link, 300);
  // Checked here so the author is told why, and again by a check constraint on
  // the column so it holds regardless of this file. An external link in a
  // banner shown to every candidate is a phishing vector if a staff account is
  // ever compromised.
  if (link && !link.startsWith("/")) {
    return {
      ok: false,
      error: "Links must be internal — start with / (for example /app/portal/merit-list).",
    };
  }

  const supabase = await createClient();

  const row = {
    title: title.slice(0, 120),
    body: body.slice(0, 2000),
    icon: clean(input.icon, 8),
    kind: input.kind,
    link,
    link_text: clean(input.linkText, 40),
    dismissable: input.dismissable,
    active: input.active,
    ends_at: input.endsAt ? new Date(input.endsAt).toISOString() : null,
  };

  const { data, error } = input.id
    ? await supabase.from("notifications").update(row).eq("id", input.id).select("id")
    : await supabase
        .from("notifications")
        .insert({ ...row, created_by: user.id })
        .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Not permitted, or already gone." };

  // Layout scope: the banner sits in the app shell, above every page.
  revalidatePath("/app", "layout");
  revalidatePath("/app/admin/notifications");
  return { ok: true, id: data[0].id };
}

export async function deleteNotice(id: number): Promise<Result> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Not permitted, or already gone." };

  revalidatePath("/app", "layout");
  revalidatePath("/app/admin/notifications");
  return { ok: true };
}

// ── Editorial ───────────────────────────────────────────────────────────

/** A URL-safe slug from a title, so an author does not have to invent one. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export async function saveArticle(input: {
  id?: number;
  slug?: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  readMinutes?: number | null;
  authorName?: string;
  publish: boolean;
}): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const title = input.title.trim();
  const summary = input.summary.trim();
  const body = input.body.trim();

  if (!title || !summary || !body) {
    return { ok: false, error: "Title, summary and body are all needed." };
  }

  const slug = (input.slug?.trim() || slugify(title)) || null;
  if (!slug) return { ok: false, error: "That title produces no usable web address." };

  const supabase = await createClient();

  const row = {
    slug,
    title: title.slice(0, 200),
    summary: summary.slice(0, 500),
    body: body.slice(0, 60000),
    category: input.category,
    read_minutes: input.readMinutes ?? null,
    author_name: (input.authorName || "MeritNama").trim().slice(0, 80),
    is_published: input.publish,
    // Stamped on first publish and left alone after, so editing a live piece
    // does not move it back to the top of the index as though it were new.
    ...(input.publish ? { published_at: new Date().toISOString() } : {}),
  };

  if (input.id) {
    const { data: existing } = await supabase
      .from("editorial_posts")
      .select("published_at")
      .eq("id", input.id)
      .maybeSingle();

    if (existing?.published_at) delete (row as { published_at?: string }).published_at;
  }

  const { data, error } = input.id
    ? await supabase.from("editorial_posts").update(row).eq("id", input.id).select("id, slug")
    : await supabase
        .from("editorial_posts")
        .insert({ ...row, created_by: user.id })
        .select("id, slug");

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Another piece already uses that web address." };
    }
    return { ok: false, error: error.message };
  }
  if (!data?.length) return { ok: false, error: "Not permitted, or already gone." };

  revalidatePath("/app/editorial", "layout");
  revalidatePath("/app/admin/editorial");
  return { ok: true, id: data[0].id, slug: data[0].slug };
}

export async function deleteArticle(id: number): Promise<Result> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("editorial_posts")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Not permitted, or already gone." };

  revalidatePath("/app/editorial", "layout");
  revalidatePath("/app/admin/editorial");
  return { ok: true };
}
