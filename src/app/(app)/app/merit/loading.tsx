import { SkeletonPage } from "@/components/app/skeleton";

/** The merit table is rows, not cards — a card skeleton here would settle into
 *  a completely different layout. */
export default function MeritLoading() {
  return <SkeletonPage label="the merit table" variant="table" width="max-w-[1600px]" />;
}
