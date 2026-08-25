/**
 * Shapes and labels for Candidate Data Changes.
 *
 * Split out of `data-changes.ts` because that module is `server-only` and the
 * browser needs these: the whole diff is filtered client-side, so the presets
 * and the field labels are read on both sides.
 */

/** Stored field values, with the label the page prints. */
export const CHANGE_FIELDS: Record<string, string> = {
  marksTotal: "Total merit marks",
  degree: "Degree aggregate",
  houseJob: "House job",
  mdcat: "MDCAT score",
  position: "Position",
  experience: "Experience",
  programMarks: "Programme marks",
  appliedIn: "Applied programmes",
  name: "Name record",
  record: "New applicant",
  prefAdded: "Preferences added",
  prefRemoved: "Preferences removed",
  prefEdited: "Preferences edited",
  prefCount: "Preference count",
};

export type ChangePreset = {
  id: string;
  label: string;
  /** Null means every change; otherwise the fields a candidate must have. */
  fields: string[] | null;
};

/**
 * The original's three sections, as presets over one dataset.
 *
 * Its own "Browse All Changes" already carries a "Marks changed" chip, so
 * filtering the single list is its idea rather than a departure from it — the
 * two tables above that browser are the same 622 candidates narrowed twice.
 */
export const CHANGE_PRESETS: ChangePreset[] = [
  { id: "all", label: "All changes", fields: null },
  { id: "marks", label: "Marks changes", fields: ["marksTotal"] },
  { id: "programme", label: "Programme marks", fields: ["programMarks"] },
  { id: "applied", label: "Applied programmes", fields: ["appliedIn"] },
  {
    id: "preferences",
    label: "Preference changes",
    // 113 of the 622 changed nothing but their preference list, so without
    // this preset — and without the counts behind it — they are invisible.
    fields: ["prefAdded", "prefRemoved", "prefEdited", "prefCount"],
  },
  { id: "new", label: "New applicants", fields: ["record"] },
];

export type ChangeKind = "appeared" | "vanished" | "revised" | "added";

export type FieldChange = {
  field: string;
  label: string;
  /** Programme code, for `programMarks` and `appliedIn` only. */
  program: string | null;
  oldValue: number | null;
  newValue: number | null;
  kind: ChangeKind;
};

export type CandidateChange = {
  applicantId: number;
  name: string | null;
  changes: FieldChange[];
  /** The total-marks movement, when there is one. What the list sorts on. */
  marksDelta: number | null;
  marksKind: ChangeKind | null;
  isNew: boolean;
};

export type DataChangesSummary = {
  generatedAt: string;
  oldCount: number;
  newCount: number;
  added: number;
  removed: number;
  changed: number;
  totalUpdates: number;
  /** How the total-marks movements break down. */
  marks: { appeared: number; vanished: number; revised: number };
  /** Candidates touched by each preset, for the chips. */
  byPreset: Record<string, number>;
};

export type DataChangesView = {
  ok: boolean;
  summary: DataChangesSummary | null;
  candidates: CandidateChange[];
};
