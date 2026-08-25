"use server";

import { revalidatePath } from "next/cache";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { LIMITS } from "./terms";
import type { ReportTarget } from "./terms";

/**
 * Writes for the community surfaces.
 *
 * ## None of these files is what makes anything safe
 *
 * Authorship comes from a database trigger reading `auth.uid()`, rate limits
 * are predicates inside the insert policies, and who may hide what is a policy
 * on the row. This layer shapes input and turns a policy violation into a
 * sentence a person can act on; it is not the control. A caller who invokes
 * these actions directly, or who skips them and talks to PostgREST, meets the
 * same rules.
 *
 * That is deliberate and worth stating plainly, because the tempting shape for
 * a forum is to check "is this my post?" in the action and write with a client
 * that can do anything. This project has a standing rule against exactly that.
 *
 * ## Every write is checked by effect
 *
 * `.select()` on each one. PostgREST answers **204 with zero rows** when a
 * policy hides the target — a success status for a write that did nothing.
 * Asserting on the error alone has already produced a silent failure three
 * times in this codebase.
 */

export type WriteResult = { ok: true; id?: number } | { ok: false; error: string };

/** A chat send returns the stored row, so the sender never waits on a socket. */
export type SentMessage = {
  id: number;
  room_id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_name: string;
};

export type SendResult =
  | { ok: true; message: SentMessage }
  | { ok: false; error: string };

/**
 * Turns a Postgres refusal into something a person can act on.
 *
 * The raw messages name policies and constraints, which tells a reader nothing
 * and tells anyone probing the API the shape of the schema.
 */
function explain(message: string, kind: string): string {
  const text = message.toLowerCase();

  if (text.includes("display name")) {
    return "Set a display name on your profile before posting.";
  }
  if (text.includes("row-level security") || text.includes("violates row-level")) {
    return `You have posted too many ${kind} recently, or your account is not verified yet. Wait a little and try again.`;
  }
  if (text.includes("check constraint") || text.includes("violates check")) {
    return "That does not fit — check the length and that nothing required is empty.";
  }
  return "That could not be saved. Try again.";
}

const clean = (value: string | null | undefined, max: number) => {
  const text = (value ?? "").trim();
  return text ? text.slice(0, max) : null;
};

// ── Discussion ──────────────────────────────────────────────────────────

export async function createThread(input: {
  category: string;
  title: string;
  body: string;
  specialty?: string;
  hospital?: string;
  yearStage?: string;
}): Promise<WriteResult> {
  const supabase = await createClient();

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { ok: false, error: "A title and a body are both needed." };

  const { data, error } = await supabase
    .from("community_threads")
    .insert({
      // `author_id` and `author_name` are deliberately absent. The trigger sets
      // both from the session; sending them would be sending a preference the
      // database ignores.
      category: input.category,
      title: title.slice(0, LIMITS.threadTitle),
      body: body.slice(0, LIMITS.threadBody),
      specialty: clean(input.specialty, 80),
      hospital: clean(input.hospital, 160),
      year_stage: input.yearStage || "any",
    } as never)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: explain(error.message, "threads") };
  if (!data) return { ok: false, error: explain("row-level security", "threads") };

  revalidatePath("/app/discussion");
  return { ok: true, id: data.id };
}

export async function createReply(input: {
  threadId: number;
  body: string;
}): Promise<WriteResult> {
  const supabase = await createClient();

  const body = input.body.trim();
  if (!body) return { ok: false, error: "Write something first." };

  const { data, error } = await supabase
    .from("community_replies")
    .insert({
      thread_id: input.threadId,
      body: body.slice(0, LIMITS.replyBody),
    } as never)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: explain(error.message, "replies") };
  if (!data) return { ok: false, error: explain("row-level security", "replies") };

  revalidatePath(`/app/discussion/${input.threadId}`);
  revalidatePath("/app/discussion");
  return { ok: true, id: data.id };
}

// ── Feed ────────────────────────────────────────────────────────────────

export async function createPost(input: {
  kind: string;
  title: string;
  body: string;
  specialty?: string;
  hospital?: string;
  rating?: number | null;
}): Promise<WriteResult> {
  const supabase = await createClient();

  const title = input.title.trim();
  const body = input.body.trim();
  if (!title || !body) return { ok: false, error: "A title and a body are both needed." };

  // A rating outside a review has nothing to rate. The column has the same
  // constraint; this makes the form's behaviour predictable rather than
  // producing a constraint error the reader cannot interpret.
  const rating =
    input.kind === "hospital_review" && input.rating ? input.rating : null;

  if (input.kind === "hospital_review" && !clean(input.hospital, 160)) {
    return { ok: false, error: "A hospital review needs a hospital." };
  }

  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      kind: input.kind,
      title: title.slice(0, LIMITS.postTitle),
      body: body.slice(0, LIMITS.postBody),
      specialty: clean(input.specialty, 80),
      hospital: clean(input.hospital, 160),
      rating,
    } as never)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: explain(error.message, "posts") };
  if (!data) return { ok: false, error: explain("row-level security", "posts") };

  revalidatePath("/app/community");
  return { ok: true, id: data.id };
}

// ── Chat ────────────────────────────────────────────────────────────────

/**
 * Sends a message and returns the stored row.
 *
 * The row comes back rather than only an id so the sender can append it
 * immediately. An earlier version returned the id and left the message to
 * arrive over the realtime socket — which meant that if the socket was not up,
 * the sender watched their own message vanish into nothing while it was in fact
 * saved. Realtime is now what carries *other people's* messages; your own never
 * depends on it.
 */
export async function sendChatMessage(input: {
  roomId: string;
  body: string;
}): Promise<SendResult> {
  const supabase = await createClient();

  const body = input.body.trim();
  if (!body) return { ok: false, error: "Write something first." };

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      room_id: input.roomId,
      body: body.slice(0, LIMITS.chatBody),
    } as never)
    .select("id, room_id, body, created_at, author_id, author_name")
    .maybeSingle();

  if (error) {
    // The staff-only room is a policy failure like any other, but a reader in
    // Announcements needs to be told which rule they met.
    if (input.roomId === "announcements") {
      return { ok: false, error: "Announcements is read-only. Post in General instead." };
    }
    return { ok: false, error: explain(error.message, "messages") };
  }
  if (!data) return { ok: false, error: explain("row-level security", "messages") };

  return { ok: true, message: data as SentMessage };
}

// ── Withdrawing your own ────────────────────────────────────────────────

const TABLE: Record<ReportTarget, "community_threads" | "community_replies" | "community_posts" | "chat_messages"> = {
  thread: "community_threads",
  reply: "community_replies",
  post: "community_posts",
  message: "chat_messages",
};

/**
 * Withdraws something you wrote.
 *
 * Sets `hidden_reason = 'author'` rather than deleting. The row survives so a
 * report filed against it still has something to review — a post that can
 * delete itself out of a moderation queue is a way to act and then remove the
 * evidence.
 *
 * The update policy is `author_id = auth.uid() or is_staff()`, so this returns
 * zero rows for anybody else's content and the check below reports that
 * honestly rather than claiming success.
 */
export async function withdrawOwn(
  target: ReportTarget,
  id: number
): Promise<WriteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from(TABLE[target])
    .update({
      hidden_at: new Date().toISOString(),
      hidden_by: user.id,
      hidden_reason: "author",
    })
    .eq("id", id)
    // Explicit, even though the policy says the same: it keeps the intent of
    // this action visible at the call site, and staff calling it would
    // otherwise silently withdraw somebody else's post under their own name.
    .eq("author_id", user.id)
    .select("id");

  if (error) return { ok: false, error: "That could not be withdrawn." };
  if (!data?.length) return { ok: false, error: "That is not yours to withdraw." };

  revalidatePath("/app/discussion");
  revalidatePath("/app/community");
  return { ok: true };
}

// ── Reporting ───────────────────────────────────────────────────────────

/**
 * Files a report.
 *
 * `reporter_id` is sent because the policy compares it to `auth.uid()` — a
 * caller who names somebody else is refused by the database, which the probe
 * confirms. The unique key means a second report from the same person on the
 * same item is rejected rather than counted twice.
 */
export async function reportContent(input: {
  target: ReportTarget;
  targetId: number;
  reason: string;
  note?: string;
}): Promise<WriteResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("content_reports")
    .insert({
      target_type: input.target,
      target_id: input.targetId,
      reporter_id: user.id,
      reason: input.reason,
      note: clean(input.note, LIMITS.reportNote),
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "You have already reported this. It is in the queue." };
    }
    return { ok: false, error: explain(error.message, "reports") };
  }
  if (!data) return { ok: false, error: explain("row-level security", "reports") };

  return { ok: true, id: data.id };
}
