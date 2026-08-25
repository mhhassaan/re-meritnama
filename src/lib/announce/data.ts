import "server-only";

import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * Banner notifications and Editorial pieces — the two things staff write in the
 * site's own voice.
 *
 * Both read **as the caller**, uncached. The select policies differ per user —
 * staff see drafts and expired banners, everybody else sees only what is live —
 * so a shared cache would hand one reader's view to another. The same rule that
 * keeps the community surfaces uncached.
 */

export type Notice = {
  id: number;
  title: string;
  body: string;
  icon: string | null;
  kind: "info" | "success" | "warning" | "danger";
  link: string | null;
  linkText: string | null;
  dismissable: boolean;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  /** True when it would not be shown to a candidate right now. */
  hiddenFromReaders: boolean;
};

export type Article = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: "analysis" | "opinion";
  readMinutes: number | null;
  authorName: string;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

function live(row: {
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}): boolean {
  if (!row.active) return false;
  const now = Date.now();
  if (row.starts_at && Date.parse(row.starts_at) > now) return false;
  if (row.ends_at && Date.parse(row.ends_at) <= now) return false;
  return true;
}

const toNotice = (row: {
  id: number;
  title: string;
  body: string;
  icon: string | null;
  kind: string;
  link: string | null;
  link_text: string | null;
  dismissable: boolean;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}): Notice => ({
  id: row.id,
  title: row.title,
  body: row.body,
  icon: row.icon,
  kind: row.kind as Notice["kind"],
  link: row.link,
  linkText: row.link_text,
  dismissable: row.dismissable,
  active: row.active,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  createdAt: row.created_at,
  hiddenFromReaders: !live(row),
});

/**
 * What belongs above the page right now.
 *
 * The window is re-checked here as well as in the policy. The policy is what
 * enforces it; this is what stops a **staff** reader — who is allowed to see
 * expired ones — being shown an expired banner as though it were live.
 */
export async function loadLiveNotices(): Promise<Notice[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).map(toNotice).filter((n) => !n.hiddenFromReaders);
}

/** Everything, including drafts and expired — staff only, by policy. */
export async function loadAllNotices(): Promise<Notice[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false });

  return (data ?? []).map(toNotice);
}

const toArticle = (row: {
  id: number;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  read_minutes: number | null;
  author_name: string;
  is_published: boolean;
  published_at: string | null;
  updated_at: string;
}): Article => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  body: row.body,
  category: row.category as Article["category"],
  readMinutes: row.read_minutes,
  authorName: row.author_name,
  isPublished: row.is_published,
  publishedAt: row.published_at,
  updatedAt: row.updated_at,
});

/**
 * The Editorial index.
 *
 * Drafts come back for staff — the policy allows it — so they are returned and
 * marked rather than filtered, which is what makes `/app/editorial` usable as
 * the place staff check their own work before publishing.
 */
export async function loadArticles(category?: string): Promise<Article[]> {
  const supabase = await createClient();

  let query = supabase
    .from("editorial_posts")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: false });

  if (category === "analysis" || category === "opinion") {
    query = query.eq("category", category);
  }

  const { data } = await query;
  return (data ?? []).map(toArticle);
}

export async function loadArticle(slug: string): Promise<Article | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("editorial_posts")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  return data ? toArticle(data) : null;
}

/** Whether the reader may write either of these. */
export async function isStaffReader(): Promise<boolean> {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!user) return false;

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  return (data ?? []).some(
    (r) => r.role === "super_admin" || r.role === "moderator"
  );
}
