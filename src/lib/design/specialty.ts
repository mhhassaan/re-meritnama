/**
 * Specialty discipline families.
 *
 * The design system deliberately does NOT give each specialty its own hue —
 * 44 distinct colors cannot stay accessible or visually distinguishable.
 * Color carries the discipline family; the specialty itself is distinguished
 * by icon and label. See DESIGN_GUIDELINES.md and the `--specialty-*` tokens
 * in globals.css.
 *
 * The keys below are the 44 specialty strings that actually appear in
 * `public/data/flat_lookup.json`. Some carry trailing whitespace in the source
 * data, so lookups go through `normalizeSpecialty`.
 */

export const SPECIALTY_FAMILIES = [
  "surgical",
  "womens",
  "medical",
  "diagnostic",
  "acute",
  "dental",
  "community",
] as const;

export type SpecialtyFamily = (typeof SPECIALTY_FAMILIES)[number];

export const FAMILY_LABELS: Record<SpecialtyFamily, string> = {
  surgical: "Surgical",
  womens: "Women's Health",
  medical: "Medical",
  diagnostic: "Diagnostic & Radiology",
  acute: "Acute & Peri-operative",
  dental: "Dental",
  community: "Basic & Community Sciences",
};

const SPECIALTY_TO_FAMILY: Record<string, SpecialtyFamily> = {
  // Surgical
  "cardiac surgery": "surgical",
  "general surgery": "surgical",
  "neuro surgery": "surgical",
  "orthopedic surgery": "surgical",
  "otorhinolaryngology ent": "surgical",
  "pediatric surgery": "surgical",
  "plastic surgery": "surgical",
  "thoracic surgery": "surgical",
  urology: "surgical",
  ophthalmology: "surgical",

  // Women's Health
  "obstetrics & gynecology": "womens",

  // Medical
  cardiology: "medical",
  dermatology: "medical",
  endocrinology: "medical",
  gastroenterology: "medical",
  medicine: "medical",
  nephrology: "medical",
  neurology: "medical",
  pediatrics: "medical",
  psychiatry: "medical",
  pulmonology: "medical",
  "clinical hematology": "medical",
  "medical oncology": "medical",
  "family medicine": "medical",

  // Diagnostic & Radiology
  "chemical pathology": "diagnostic",
  "diagnostic radiology": "diagnostic",
  hematology: "diagnostic",
  histopathology: "diagnostic",
  microbiology: "diagnostic",
  radiotherapy: "diagnostic",
  "radiation oncology": "diagnostic",

  // Acute & Peri-operative
  anaesthesia: "acute",
  "cardio thoracic anesthesia": "acute",
  "emergency medicine": "acute",

  // Dental
  "operative dentistry": "dental",
  "oral & maxillofacial surgery": "dental",
  orthodontics: "dental",
  prosthodontics: "dental",

  // Basic & Community Sciences
  "community medicine": "community",
  "forensic medicine": "community",
  anatomy: "community",
  biochemistry: "community",
  pharmacology: "community",
  physiology: "community",
};

/** Source data contains trailing spaces and inconsistent casing. */
export function normalizeSpecialty(specialty: string): string {
  return specialty.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Falls back to `medical` for a specialty absent from the map — an unknown
 * specialty should render in a plausible family rather than blank or crash,
 * since the source data gains specialties between induction cycles.
 */
export function familyOf(specialty: string): SpecialtyFamily {
  return SPECIALTY_TO_FAMILY[normalizeSpecialty(specialty)] ?? "medical";
}

/**
 * Tailwind class names, so components never hardcode a specialty color.
 *
 * These are written out in full rather than built with a template literal:
 * Tailwind scans source files as plain text and cannot see a class name that
 * only exists once the string is interpolated at runtime.
 */
export const FAMILY_CLASSES: Record<
  SpecialtyFamily,
  { text: string; bg: string; border: string }
> = {
  surgical: {
    text: "text-specialty-surgical",
    bg: "bg-specialty-surgical",
    border: "border-specialty-surgical",
  },
  womens: {
    text: "text-specialty-womens",
    bg: "bg-specialty-womens",
    border: "border-specialty-womens",
  },
  medical: {
    text: "text-specialty-medical",
    bg: "bg-specialty-medical",
    border: "border-specialty-medical",
  },
  diagnostic: {
    text: "text-specialty-diagnostic",
    bg: "bg-specialty-diagnostic",
    border: "border-specialty-diagnostic",
  },
  acute: {
    text: "text-specialty-acute",
    bg: "bg-specialty-acute",
    border: "border-specialty-acute",
  },
  dental: {
    text: "text-specialty-dental",
    bg: "bg-specialty-dental",
    border: "border-specialty-dental",
  },
  community: {
    text: "text-specialty-community",
    bg: "bg-specialty-community",
    border: "border-specialty-community",
  },
};

/**
 * The raw CSS variable behind each family.
 *
 * Charts need a color *value*, not a class: an SVG `stroke` or a `@bklit`
 * `stroke` prop takes `var(--specialty-acute)`. This is the only sanctioned way
 * to reach the token directly — it still resolves through the variable, so it
 * flips with the theme like everything else.
 */
export const FAMILY_VAR: Record<SpecialtyFamily, string> = {
  surgical: "--specialty-surgical",
  womens: "--specialty-womens",
  medical: "--specialty-medical",
  diagnostic: "--specialty-diagnostic",
  acute: "--specialty-acute",
  dental: "--specialty-dental",
  community: "--specialty-community",
};

export function specialtyColorVar(specialty: string): string {
  return `var(${FAMILY_VAR[familyOf(specialty)]})`;
}