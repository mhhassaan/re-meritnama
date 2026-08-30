import { SkeletonPage } from "@/components/app/skeleton";

/** No figure strip on Editorial, and the content is pieces rather than rows. */
export default function EditorialLoading() {
  return <SkeletonPage label="Editorial" stats={false} width="max-w-[900px]" />;
}
