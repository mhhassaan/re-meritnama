"use client";

import Link from "next/link";
import { ArrowUpRight01Icon } from "@/components/ui/arrow-up-right-01";
import { useActionIcon } from "@/components/app/action-icon";

/**
 * The "Go to Calculator" / "Analyze my score" link at the foot of each Start
 * Here step.
 *
 * These were a label and a literal `→` character, which is the one thing the
 * icon policy exists to prevent: a control whose only affordance is that the
 * text happens to be teal. The standing rule is that anything clickable carries
 * an animated icon, and the arrow is exactly the case it was written for.
 *
 * A client component because `useActionIcon` is a hook and the page is a server
 * component. It exists so the *link* drives the animation: these icons animate
 * on hover of their own element, which is 14 pixels at the end of a label, so
 * left alone they play only when the pointer crosses the artwork itself. The
 * hook's `ref` switches the icon to parent control, and it wires `onFocus` and
 * `onBlur` alongside — without those the cue is pointer-only, which makes it
 * feedback for some people and decoration for everyone else.
 *
 * The icon renders a `<div>`, so the label beside it is a `<span>` and the link
 * is the flex container rather than the icon sitting inside a paragraph.
 */
export function StepLink({
  href,
  label,
  className = "",
}: {
  href: string;
  label: string;
  className?: string;
}) {
  const { ref, handlers } = useActionIcon();

  return (
    <Link
      href={href}
      {...handlers}
      className={`group inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-accent transition-colors hover:text-accent-hover ${className}`}
    >
      <span>{label}</span>
      {/* The nudge is the link's, not the icon's: the icon plays its own
          animation, and a translate on top of that reads as one gesture rather
          than two things moving at different times. */}
      <span className="transition-transform duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none">
        <ArrowUpRight01Icon ref={ref} size={14} aria-hidden />
      </span>
    </Link>
  );
}
