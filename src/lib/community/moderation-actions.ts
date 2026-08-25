"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import type { ReportTarget } from "./terms";

/**
 * Moderation decisions.
 *
 * Run **as the caller**, never with the service role. What permits a hide is
 * `is_staff()` inside the update policy on each table; what permits resolving a
 * report is the same test on `content_reports`. This file contains no
 * permission check of its own beyond reading the role for the UI, and that is
 * on purpose — a second copy of the rule is a second place for it to drift.
 *
 * Both halves of a decision are recorded: the content's `hidden_at` /
 * `hidden_by`, and the report's `resolved_at` / `resolved_by` / `action`. A
 * queue that only records that somebody looked cannot answer "why is this
 * post gone", which is the question a moderation log exists for.
 */

export type ModerationResult = { ok: true } | { ok: false; error: string };

const TABLE: Record<
  ReportTarget,
  "community_threads" | "community_replies" | "community_posts" | "chat_messages"
> = {
  thread: "community_threads",
  reply: "community_replies",
  post: "community_posts",
  message: "chat_messages",
};

async function resolveReports(
  supabase: Awaited<ReturnType<typeof createClient>>,
  target: ReportTarget,
  targetId: number,
  userId: string,
  action: "hidden" | "kept"
) {
  return supabase
    .from("content_reports")
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      action,
    })
    .eq("target_type", target)
    .eq("target_id", targetId)
    .is("resolved_at", null)
    .select("id");
}

export async function hideContent(
  target: ReportTarget,
  targetId: number
): Promise<ModerationResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const supabase = await createClient();

  // Checked by effect. PostgREST answers 204 with zero rows when the policy
  // hides the target, so a non-staff caller would otherwise be told the post
  // was hidden while nothing happened.
  const { data, error } = await supabase
    .from(TABLE[target])
    .update({
      hidden_at: new Date().toISOString(),
      hidden_by: user.id,
      hidden_reason: "staff",
    })
    .eq("id", targetId)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Not permitted, or already gone." };

  await resolveReports(supabase, target, targetId, user.id, "hidden");

  revalidatePath("/app/admin/reports");
  revalidatePath("/app/discussion");
  revalidatePath("/app/community");
  return { ok: true };
}

/**
 * Puts something back, and closes the reports against it as "kept".
 *
 * The pairing matters: restoring content without resolving its reports leaves
 * an item that reappears in the queue forever, and the next reviewer has no
 * way to know it was already considered.
 */
export async function restoreContent(
  target: ReportTarget,
  targetId: number
): Promise<ModerationResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from(TABLE[target])
    .update({ hidden_at: null, hidden_by: null, hidden_reason: null })
    .eq("id", targetId)
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Not permitted, or already gone." };

  await resolveReports(supabase, target, targetId, user.id, "kept");

  revalidatePath("/app/admin/reports");
  revalidatePath("/app/discussion");
  revalidatePath("/app/community");
  return { ok: true };
}

/** Closes the reports and leaves the content alone. */
export async function dismissReports(
  target: ReportTarget,
  targetId: number
): Promise<ModerationResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const supabase = await createClient();
  const { data, error } = await resolveReports(
    supabase,
    target,
    targetId,
    user.id,
    "kept"
  );

  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Not permitted, or already resolved." };

  revalidatePath("/app/admin/reports");
  return { ok: true };
}
