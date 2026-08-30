import { SkeletonPage } from "@/components/app/skeleton";

export default function DiscussionLoading() {
  return <SkeletonPage label="Discussion" stats={false} width="max-w-[1000px]" />;
}
