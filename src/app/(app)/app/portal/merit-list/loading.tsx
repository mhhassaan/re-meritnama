import { SkeletonPage } from "@/components/app/skeleton";

/** The heaviest read in the app — a full round with its queues. */
export default function MeritListLoading() {
  return <SkeletonPage label="the merit list" width="max-w-[1400px]" />;
}
