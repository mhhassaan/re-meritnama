import { SkeletonPage } from "@/components/app/skeleton";

export default function AccreditationLoading() {
  return (
    <SkeletonPage
      label="the accreditation register"
      variant="table"
      width="max-w-[1400px]"
    />
  );
}
