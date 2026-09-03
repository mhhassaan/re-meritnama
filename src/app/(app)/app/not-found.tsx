import type { Metadata } from "next";
import Link from "next/link";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { CompassIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Not found | MeritNama",
};

/**
 * A 404 inside the app shell.
 *
 * Placed in the `(app)` group so it renders with the header and the navigation
 * rail — somebody who mistyped a URL or followed a stale link is still signed
 * in, and stripping the nav away would strand them on a dead end.
 *
 * ## It does not guess why
 *
 * `notFound()` is thrown from three places here, and two of them are not
 * "wrong address":
 *
 *   - a thread that exists but has been hidden from this reader
 *   - an Editorial draft, which is staff-only
 *   - an actual mistyped slug
 *
 * Telling them apart would confirm that a hidden thread or an unpublished piece
 * exists, which is precisely what the policy just declined to do. So the copy
 * covers all three honestly rather than asserting the page never existed.
 */
export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-[760px] px-4 py-20 sm:px-6 md:py-28 lg:px-8">
      <Eyebrow>404</Eyebrow>

      <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-5xl text-balance">
        Nothing here{" "}
        <span className="text-accent">to show you</span>
      </h1>

      <p className="mt-7 max-w-xl text-[15px] leading-relaxed text-fg-muted">
        Either this address is wrong, or what was here is no longer
        visible to you. Nothing is broken.
      </p>

      <Bezel className="mt-10" innerClassName="p-6">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-fg-muted">
          Try one of these
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Destination
            href="/app"
            title="Your portal"
            note="Your record, and where to go next."
          />
          <Destination
            href="/app/merit"
            title="Merit table"
            note="Closing merits from 2020 to 2026."
          />
          <Destination
            href="/app/portal/merit-list"
            title="This cycle's merit list"
            note="Who is in each seat, and who is behind them."
          />
          <Destination
            href="/app/guide"
            title="Guide"
            note="What every term on this site means."
          />
        </div>
      </Bezel>

      <p className="mt-8 flex items-start gap-2.5 text-xs leading-relaxed text-fg-subtle">
        <CompassIcon className="mt-px h-4 w-auto shrink-0" />
        <span>
          If you followed a link from inside the site and expected
          something here, that is worth reporting.
        </span>
      </p>
    </div>
  );
}

function Destination({
  href,
  title,
  note,
}: {
  href: string;
  title: string;
  note: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-sm border border-border-strong p-4 transition-colors hover:border-accent"
    >
      <p className="font-sans text-sm font-bold text-foreground transition-colors group-hover:text-accent">
        {title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-fg-muted">{note}</p>
    </Link>
  );
}
