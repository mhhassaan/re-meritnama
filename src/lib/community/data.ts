import "server-only";

import { createClient, getCurrentUser } from "@/lib/supabase/server";

/**
 * Reads for the three community surfaces.
 *
 * Everything is read **as the caller**. Nothing here is cached across requests:
 * every one of these tables has a policy that differs per user — a hidden post
 * is visible to its author and to staff and to nobody else — so a shared cache
 * would hand one reader's view to another. That is the same rule that keeps
 * Data Changes uncached, and it matters more here, because the rows are things
 * people wrote about each other.
 *
 * Author names come from the row, not from `profiles`. See the migration: the
 * name is copied at write time so that posting reveals who you are without
 * widening the policy that protects people who chose not to be listed.
 */

export const THREADS_PER_PAGE = 20;
export const POSTS_PER_PAGE = 20;
export const CHAT_HISTORY = 100;

export type Author = {
  id: string;
  name: string;
  /** True for the signed-in reader's own content. */
  isMe: boolean;
};

export type Moderation = {
  hidden: boolean;
  /** 'author' when withdrawn by its writer, 'staff' when removed. */
  reason: string | null;
};

export type Thread = {
  id: number;
  category: string;
  title: string;
  body: string;
  specialty: string | null;
  hospital: string | null;
  yearStage: string | null;
  replyCount: number;
  createdAt: string;
  lastReplyAt: string | null;
  editedAt: string | null;
  author: Author;
  moderation: Moderation;
};

export type Reply = {
  id: number;
  body: string;
  createdAt: string;
  editedAt: string | null;
  author: Author;
  moderation: Moderation;
};

export type FeedPost = {
  id: number;
  kind: string;
  title: string;
  body: string;
  specialty: string | null;
  hospital: string | null;
  rating: number | null;
  createdAt: string;
  editedAt: string | null;
  author: Author;
  moderation: Moderation;
};

export type ChatRoom = {
  id: string;
  label: string;
  description: string | null;
  staffOnlyWrite: boolean;
};

export type ChatMessage = {
  id: number;
  roomId: string;
  body: string;
  createdAt: string;
  author: Author;
  moderation: Moderation;
};

/**
 * Whether the reader may write at all, and why not when they may not.
 *
 * Mirrors `private.can_post()`. Restated here only so the composer can explain
 * itself before the attempt — the database is still what enforces it, and a
 * caller who bypasses this gets a policy violation rather than a post.
 */
export type PostingRights = {
  canPost: boolean;
  /** 'unverified' | 'no-display-name' | null */
  blockedBy: "unverified" | "no-display-name" | null;
  isStaff: boolean;
  userId: string | null;
};

export async function loadPostingRights(): Promise<PostingRights> {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);

  if (!user) {
    return { canPost: false, blockedBy: "unverified", isStaff: false, userId: null };
  }

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      // Required, not defensive: `profiles_select` is `own OR is_public OR
      // staff`, so an unfiltered `maybeSingle()` matches every public profile
      // and errors on finding more than one.
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  const hasName = Boolean(profile?.display_name?.trim());
  const verified = Boolean(user.email_confirmed_at);

  return {
    canPost: verified && hasName,
    blockedBy: !verified ? "unverified" : !hasName ? "no-display-name" : null,
    isStaff: Boolean(roles?.length),
    userId: user.id,
  };
}

const authorOf = (
  row: { author_id: string; author_name: string },
  me: string | null
): Author => ({
  id: row.author_id,
  name: row.author_name,
  isMe: me === row.author_id,
});

const moderationOf = (row: {
  hidden_at: string | null;
  hidden_reason: string | null;
}): Moderation => ({
  hidden: Boolean(row.hidden_at),
  reason: row.hidden_reason,
});

// ── Discussion ──────────────────────────────────────────────────────────

export type ThreadFilters = {
  category?: string;
  search?: string;
  page?: number;
};

export type ThreadsView = {
  threads: Thread[];
  matched: number;
  page: number;
  pageCount: number;
  /** Threads per category, for the chips. Counted over everything visible. */
  byCategory: Record<string, number>;
};

export async function loadThreads(
  filters: ThreadFilters = {}
): Promise<ThreadsView> {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);

  const page = Math.max(1, Math.trunc(filters.page ?? 1) || 1);
  const from = (page - 1) * THREADS_PER_PAGE;

  let query = supabase
    .from("community_threads")
    .select("*", { count: "exact" })
    // Newest activity first: a thread with a reply an hour ago is more use than
    // one started yesterday and never answered.
    .order("last_reply_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (filters.category) query = query.eq("category", filters.category);

  const term = filters.search?.trim();
  if (term) {
    // Commas and parentheses are PostgREST's own separators inside `or`, so
    // they are stripped rather than escaped.
    const safe = term.replace(/[,()]/g, " ").trim();
    query = query.or(`title.ilike.*${safe}*,body.ilike.*${safe}*`);
  }

  const { data, count, error } = await query.range(
    from,
    from + THREADS_PER_PAGE - 1
  );

  if (error) {
    return { threads: [], matched: 0, page: 1, pageCount: 1, byCategory: {} };
  }

  // Counted separately and unfiltered, so choosing a category does not then
  // report every other category as empty.
  const { data: facetRows } = await supabase
    .from("community_threads")
    .select("category")
    .is("hidden_at", null);

  const byCategory: Record<string, number> = {};
  for (const row of facetRows ?? []) {
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
  }

  const matched = count ?? data?.length ?? 0;

  return {
    threads: (data ?? []).map((row) => ({
      id: row.id,
      category: row.category,
      title: row.title,
      body: row.body,
      specialty: row.specialty,
      hospital: row.hospital,
      yearStage: row.year_stage,
      replyCount: row.reply_count,
      createdAt: row.created_at,
      lastReplyAt: row.last_reply_at,
      editedAt: row.edited_at,
      author: authorOf(row, user?.id ?? null),
      moderation: moderationOf(row),
    })),
    matched,
    page,
    pageCount: Math.max(1, Math.ceil(matched / THREADS_PER_PAGE)),
    byCategory,
  };
}

export async function loadThread(
  id: number
): Promise<{ thread: Thread; replies: Reply[] } | null> {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);

  const { data: row } = await supabase
    .from("community_threads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!row) return null;

  const { data: replyRows } = await supabase
    .from("community_replies")
    .select("*")
    .eq("thread_id", id)
    .order("created_at", { ascending: true });

  return {
    thread: {
      id: row.id,
      category: row.category,
      title: row.title,
      body: row.body,
      specialty: row.specialty,
      hospital: row.hospital,
      yearStage: row.year_stage,
      replyCount: row.reply_count,
      createdAt: row.created_at,
      lastReplyAt: row.last_reply_at,
      editedAt: row.edited_at,
      author: authorOf(row, user?.id ?? null),
      moderation: moderationOf(row),
    },
    replies: (replyRows ?? []).map((reply) => ({
      id: reply.id,
      body: reply.body,
      createdAt: reply.created_at,
      editedAt: reply.edited_at,
      author: authorOf(reply, user?.id ?? null),
      moderation: moderationOf(reply),
    })),
  };
}

// ── Feed ────────────────────────────────────────────────────────────────

export type FeedFilters = {
  kind?: string;
  specialty?: string;
  hospital?: string;
  page?: number;
};

export type FeedView = {
  posts: FeedPost[];
  matched: number;
  page: number;
  pageCount: number;
  facets: { specialties: string[]; hospitals: string[] };
  byKind: Record<string, number>;
};

export async function loadFeed(filters: FeedFilters = {}): Promise<FeedView> {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);

  const page = Math.max(1, Math.trunc(filters.page ?? 1) || 1);
  const from = (page - 1) * POSTS_PER_PAGE;

  let query = supabase
    .from("community_posts")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.specialty) query = query.eq("specialty", filters.specialty);
  if (filters.hospital) query = query.eq("hospital", filters.hospital);

  const { data, count, error } = await query.range(from, from + POSTS_PER_PAGE - 1);

  if (error) {
    return {
      posts: [],
      matched: 0,
      page: 1,
      pageCount: 1,
      facets: { specialties: [], hospitals: [] },
      byKind: {},
    };
  }

  const { data: facetRows } = await supabase
    .from("community_posts")
    .select("kind, specialty, hospital")
    .is("hidden_at", null);

  const byKind: Record<string, number> = {};
  const specialties = new Set<string>();
  const hospitals = new Set<string>();
  for (const row of facetRows ?? []) {
    byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
    if (row.specialty) specialties.add(row.specialty);
    if (row.hospital) hospitals.add(row.hospital);
  }

  const matched = count ?? data?.length ?? 0;
  const collate = (a: string, b: string) => a.localeCompare(b);

  return {
    posts: (data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      body: row.body,
      specialty: row.specialty,
      hospital: row.hospital,
      rating: row.rating,
      createdAt: row.created_at,
      editedAt: row.edited_at,
      author: authorOf(row, user?.id ?? null),
      moderation: moderationOf(row),
    })),
    matched,
    page,
    pageCount: Math.max(1, Math.ceil(matched / POSTS_PER_PAGE)),
    facets: {
      specialties: [...specialties].sort(collate),
      hospitals: [...hospitals].sort(collate),
    },
    byKind,
  };
}

// ── Chat ────────────────────────────────────────────────────────────────

export async function loadChatRooms(): Promise<ChatRoom[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_rooms")
    .select("*")
    .order("sort_order", { ascending: true });

  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    description: row.description,
    staffOnlyWrite: row.staff_only_write,
  }));
}

/**
 * The last `CHAT_HISTORY` messages in a room, oldest first.
 *
 * Fetched newest-first and reversed rather than ordered ascending with an
 * offset: a room's tail is what a reader wants, and "the newest hundred" is a
 * cheap query while "the last hundred of an unknown number" is not.
 */
export async function loadChatMessages(roomId: string): Promise<ChatMessage[]> {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);

  const { data } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(CHAT_HISTORY);

  return (data ?? [])
    .map((row) => ({
      id: row.id,
      roomId: row.room_id,
      body: row.body,
      createdAt: row.created_at,
      author: authorOf(row, user?.id ?? null),
      moderation: moderationOf(row),
    }))
    .reverse();
}
