import {
  AlertIcon,
  ArchiveIcon,
  BookQuestionIcon,
  CompassIcon,
  DocumentIcon,
  HouseIcon,
  MessagesIcon,
  TableIcon,
  TrophyIcon,
} from "@/components/icons/koboyo";

/**
 * A drawn mark for each Discussion category and each Feed kind.
 *
 * Koboyo rather than `@hugeicons-animated`, which is the split the icon policy
 * describes: these mark *what a thing is*, the same job the specialty marker
 * does beside a heading. They sit on the filter chips too, but the chip is a
 * label for a taxonomy that happens to be clickable, not a toolbar action — the
 * mark identifies the category, not the act of filtering. The composer's
 * buttons and the reporting control still carry animated icons.
 *
 * The choices follow the original's own emoji, so a reader arriving from it
 * recognises the row rather than relearning it: 💬 General, ❓ Q&A, 📚 Study,
 * 🏠 Hospital, 📋 Merit, ⭐ Story, ⚠ Concern; and ❓ Question, 🏥 Hospital
 * review, 📚 Resource, 🏆 Result update.
 *
 * Story takes the compass rather than a second trophy: "how a cycle went for
 * you" is a journey, and the trophy is already the Feed's result update, where
 * it stands in for 🏆 exactly.
 *
 * ## Sizing
 *
 * One dimension only. Koboyo is hand-drawn with a per-icon viewBox, so forcing
 * one into a square box distorts it — `h-3 w-auto` here, and the differing
 * widths are harmless in a wrapping row of chips. That is the opposite of the
 * navigation, where varying widths made every label start at a different x and
 * is why the rails use the animated set instead.
 */

type Mark = (props: { className?: string; title?: string }) => React.JSX.Element;

const CATEGORY_ICON: Record<string, Mark> = {
  general: MessagesIcon,
  qa: BookQuestionIcon,
  study: DocumentIcon,
  hospital: HouseIcon,
  merit: TableIcon,
  story: CompassIcon,
  concern: AlertIcon,
};

const KIND_ICON: Record<string, Mark> = {
  question: BookQuestionIcon,
  hospital_review: HouseIcon,
  resource: DocumentIcon,
  result_update: TrophyIcon,
};

export function CategoryIcon({
  category,
  className = "h-3 w-auto shrink-0",
}: {
  category: string;
  className?: string;
}) {
  // Archive is the fallback rather than nothing: a category the database gained
  // before this map did should still line up with its neighbours.
  const Icon = CATEGORY_ICON[category] ?? ArchiveIcon;
  return <Icon className={className} />;
}

export function KindIcon({
  kind,
  className = "h-3 w-auto shrink-0",
}: {
  kind: string;
  className?: string;
}) {
  const Icon = KIND_ICON[kind] ?? ArchiveIcon;
  return <Icon className={className} />;
}
