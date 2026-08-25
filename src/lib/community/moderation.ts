import "server-only";

import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { ReportTarget } from "./terms";

/**
 * The staff moderation queue.
 *
 * Read and written **as the caller**, under `content_reports`' own policies —
 * select is `own OR staff`, update is staff only. No service-role client
 * anywhere in this file. A moderation tool that runs with RLS switched off is
 * one bug away from being a way to read every report in the system, and there
 * is nothing here that the staff policies do not already permit.
 *
 * ## Reports are grouped by the thing reported, not listed one per row
 *
 * Three people objecting to one post is one decision, not three. Listing rows
 * would also let a coordinated group make one post look like a queue of
 * problems, which is exactly the pressure a reviewer should not be under.
 */

export type ReportedItem = {
  target: ReportTarget;
  targetId: number;
  /** Reports on this item, newest first. */
  reports: {
    id: number;
    reason: string;
    note: string | null;
    createdAt: string;
    resolvedAt: string | null;
    action: string | null;
  }[];
  /** The content itself, or null when it has been deleted outright. */
  content: {
    title: string | null;
    body: string;
    authorName: string;
    authorId: string;
    createdAt: string;
    hidden: boolean;
    hiddenReason: string | null;
    /** Where a reviewer can go and see it in place. */
    href: string | null;
  } | null;
};

export type QueueView = {
  ok: boolean;
  open: ReportedItem[];
  resolved: ReportedItem[];
  counts: { open: number; resolved: number };
};

const EMPTY: QueueView = {
  ok: false,
  open: [],
  resolved: [],
  counts: { open: 0, resolved: 0 },
};

export async function loadQueue(): Promise<QueueView> {
  const [supabase, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!user) return EMPTY;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const isStaff = (roles ?? []).some(
    (r) => r.role === "super_admin" || r.role === "moderator"
  );
  if (!isStaff) return EMPTY;

  const { data: reports, error } = await supabase
    .from("content_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return EMPTY;

  // Grouped before anything is fetched, so one item costs one content read
  // however many people reported it.
  const groups = new Map<string, ReportedItem>();
  for (const report of reports ?? []) {
    const key = `${report.target_type}:${report.target_id}`;
    let entry = groups.get(key);
    if (!entry) {
      entry = {
        target: report.target_type as ReportTarget,
        targetId: report.target_id,
        reports: [],
        content: null,
      };
      groups.set(key, entry);
    }
    entry.reports.push({
      id: report.id,
      reason: report.reason,
      note: report.note,
      createdAt: report.created_at,
      resolvedAt: report.resolved_at,
      action: report.action,
    });
  }

  await attachContent(supabase, [...groups.values()]);

  const all = [...groups.values()];
  const isOpen = (item: ReportedItem) => item.reports.some((r) => !r.resolvedAt);

  return {
    ok: true,
    open: all.filter(isOpen),
    resolved: all.filter((item) => !isOpen(item)),
    counts: {
      open: all.filter(isOpen).length,
      resolved: all.filter((item) => !isOpen(item)).length,
    },
  };
}

async function attachContent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: ReportedItem[]
) {
  const byType = {
    thread: items.filter((i) => i.target === "thread").map((i) => i.targetId),
    reply: items.filter((i) => i.target === "reply").map((i) => i.targetId),
    post: items.filter((i) => i.target === "post").map((i) => i.targetId),
    message: items.filter((i) => i.target === "message").map((i) => i.targetId),
  };

  const [threads, replies, posts, messages] = await Promise.all([
    byType.thread.length
      ? supabase.from("community_threads").select("*").in("id", byType.thread)
      : Promise.resolve({ data: [] }),
    byType.reply.length
      ? supabase.from("community_replies").select("*").in("id", byType.reply)
      : Promise.resolve({ data: [] }),
    byType.post.length
      ? supabase.from("community_posts").select("*").in("id", byType.post)
      : Promise.resolve({ data: [] }),
    byType.message.length
      ? supabase.from("chat_messages").select("*").in("id", byType.message)
      : Promise.resolve({ data: [] }),
  ]);

  const index = new Map<string, ReportedItem["content"]>();

  for (const row of threads.data ?? []) {
    index.set(`thread:${row.id}`, {
      title: row.title,
      body: row.body,
      authorName: row.author_name,
      authorId: row.author_id,
      createdAt: row.created_at,
      hidden: Boolean(row.hidden_at),
      hiddenReason: row.hidden_reason,
      href: `/app/discussion/${row.id}`,
    });
  }
  for (const row of replies.data ?? []) {
    index.set(`reply:${row.id}`, {
      title: null,
      body: row.body,
      authorName: row.author_name,
      authorId: row.author_id,
      createdAt: row.created_at,
      hidden: Boolean(row.hidden_at),
      hiddenReason: row.hidden_reason,
      href: `/app/discussion/${row.thread_id}`,
    });
  }
  for (const row of posts.data ?? []) {
    index.set(`post:${row.id}`, {
      title: row.title,
      body: row.body,
      authorName: row.author_name,
      authorId: row.author_id,
      createdAt: row.created_at,
      hidden: Boolean(row.hidden_at),
      hiddenReason: row.hidden_reason,
      href: `/app/community`,
    });
  }
  for (const row of messages.data ?? []) {
    index.set(`message:${row.id}`, {
      title: null,
      body: row.body,
      authorName: row.author_name,
      authorId: row.author_id,
      createdAt: row.created_at,
      hidden: Boolean(row.hidden_at),
      hiddenReason: row.hidden_reason,
      href: `/app/portal/chat?room=${row.room_id}`,
    });
  }

  for (const item of items) {
    item.content = index.get(`${item.target}:${item.targetId}`) ?? null;
  }
}
