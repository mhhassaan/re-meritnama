import { SkeletonPage } from "@/components/app/skeleton";

/**
 * The loading state for every page under `/app`.
 *
 * One file rather than thirty, because nearly every page here is built from the
 * same template — eyebrow, display heading, standfirst, a figure strip, then
 * content — so a single placeholder matches all of them closely enough that
 * nothing jumps when the real page arrives.
 *
 * **This does not fire on a filter change.** `useFilterNav` wraps those in
 * `startTransition`, and React keeps the previous UI painted rather than
 * falling back to a Suspense boundary. That is deliberate and load-bearing: a
 * skeleton on every dropdown change is exactly the "it reloads the whole page"
 * complaint this app already fixed once.
 *
 * Routes whose shape differs enough to be worth their own file have one
 * alongside their `page.tsx`.
 */
export default function AppLoading() {
  return <SkeletonPage label="this page" />;
}
