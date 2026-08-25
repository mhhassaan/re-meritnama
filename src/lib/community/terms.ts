/**
 * Vocabulary shared by the community surfaces and their forms.
 *
 * Client-safe on purpose: the composers are client components and the labels
 * have to be readable on both sides. Nothing here reaches the database — every
 * value is also constrained by a `check` on the column, so a caller who posts
 * a category we do not list is refused by Postgres rather than by this file.
 */

export const THREAD_CATEGORIES = [
  { id: "general", label: "General", hint: "Anything that does not fit the others." },
  { id: "qa", label: "Question & advice", hint: "Ask the people who have been through it." },
  { id: "study", label: "Study & FCPS", hint: "Exam preparation and training." },
  { id: "hospital", label: "Hospital insights", hint: "What a place is actually like." },
  { id: "merit", label: "Merit & induction", hint: "Marks, rounds, and the seat matrix." },
  { id: "story", label: "Experience", hint: "How a cycle went for you." },
  { id: "concern", label: "Concern", hint: "Something that looks wrong." },
] as const;

export type ThreadCategory = (typeof THREAD_CATEGORIES)[number]["id"];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  THREAD_CATEGORIES.map((c) => [c.id, c.label])
);

/** The original's stages, kept so a reader can weight an answer by who gave it. */
export const YEAR_STAGES = [
  { id: "any", label: "Not applicable" },
  { id: "aspirant", label: "Aspirant (pre-induction)" },
  { id: "r1", label: "R1 — year 1" },
  { id: "r2", label: "R2 — year 2" },
  { id: "r3", label: "R3 — year 3" },
  { id: "r4", label: "R4 — year 4" },
  { id: "completed", label: "Completed" },
] as const;

export const YEAR_STAGE_LABEL: Record<string, string> = Object.fromEntries(
  YEAR_STAGES.map((y) => [y.id, y.label])
);

export const POST_KINDS = [
  { id: "question", label: "Question", hint: "Short, answerable, about one thing." },
  {
    id: "hospital_review",
    label: "Hospital review",
    hint: "Your own experience of training somewhere. Carries a rating.",
  },
  { id: "resource", label: "Resource or tip", hint: "Something worth passing on." },
  { id: "result_update", label: "Result update", hint: "What a round actually did." },
] as const;

export type PostKind = (typeof POST_KINDS)[number]["id"];

export const POST_KIND_LABEL: Record<string, string> = Object.fromEntries(
  POST_KINDS.map((k) => [k.id, k.label])
);

/**
 * Why something is being reported.
 *
 * `personal_information` is first among the specific ones deliberately. This
 * product exists because a previous version of it published CNICs and phone
 * numbers, and the likeliest serious harm from a free-text box here is
 * somebody pasting another candidate's details into it.
 */
export const REPORT_REASONS = [
  {
    id: "personal_information",
    label: "Someone's personal details",
    hint: "A CNIC, phone number, address, or anything identifying a person who did not post it.",
  },
  {
    id: "harassment",
    label: "Harassment or abuse",
    hint: "Targeted at a person or a group.",
  },
  {
    id: "misinformation",
    label: "Misleading about the induction",
    hint: "A claim about marks, seats or rounds that is not true.",
  },
  { id: "spam", label: "Spam or advertising", hint: "" },
  { id: "other", label: "Something else", hint: "Say what in the note." },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["id"];

export const REPORT_REASON_LABEL: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.id, r.label])
);

/** What a report can be filed against. Matches the `target_type` check. */
export type ReportTarget = "thread" | "reply" | "post" | "message";

export const TARGET_LABEL: Record<ReportTarget, string> = {
  thread: "Discussion thread",
  reply: "Reply",
  post: "Feed post",
  message: "Chat message",
};

/** Limits, restated for the UI. The database holds the enforcing copy. */
export const LIMITS = {
  threadTitle: 160,
  threadBody: 8000,
  replyBody: 4000,
  postTitle: 160,
  postBody: 4000,
  chatBody: 1000,
  reportNote: 1000,
} as const;
