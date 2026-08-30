import { SkeletonPage } from "@/components/app/skeleton";

export default function ArticleLoading() {
  return (
    <SkeletonPage
      label="this piece"
      stats={false}
      variant="prose"
      width="max-w-[760px]"
    />
  );
}
