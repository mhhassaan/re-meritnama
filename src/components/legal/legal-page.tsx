import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { LandingFooter } from "@/components/landing/landing-footer";
import { LegalToc } from "@/components/legal/legal-toc";

/**
 * The shell for the two legal pages linked from the landing footer.
 *
 * These sit outside the `(app)` group deliberately: a privacy policy that only
 * a signed-in user can read is not a privacy policy. So there is no app shell,
 * no navigation rail, and no database read — both pages are static.
 *
 * They are marketing surfaces, so they use the `brand-*` family and stay light
 * in both themes, exactly as the landing page does. The same reasoning applies
 * more strongly here than there: a legal document should look identical to
 * every reader, and to the same reader on two different days.
 *
 * `updated` is printed rather than computed. A page that silently claims to
 * have been revised today, every day, is worse than one with an honest date on
 * it — the date is the reader's only handle on which version they agreed to.
 */
export function LegalPage({
  eyebrow,
  title,
  standfirst,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  standfirst: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-cream font-sans text-brand-ink antialiased">
      {/* A pared-back header. The landing nav is anchor-driven and belongs to
          the scrolling page it lives on; here there is nothing to scroll to, so
          the logo goes home and the actions are the two that always apply. */}
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-brand-cream/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="flex items-center" aria-label="MeritNama home">
            <Image
              src="/logo.png"
              alt="MeritNama"
              width={180}
              height={45}
              className="h-9 w-auto object-contain"
              priority
            />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden min-h-[40px] items-center rounded-sm px-4 py-2 text-[14px] font-semibold text-brand-ink transition-colors hover:text-brand-teal sm:flex"
            >
              Sign In
            </Link>
            <Link
              href="/app"
              className="group flex min-h-[40px] items-center gap-2 rounded-sm bg-brand-teal-deep px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_2px_10px_rgba(0,0,0,0.1)] transition-all duration-150 ease-out hover:bg-brand-teal-deeper active:scale-[0.96]"
            >
              <span>Launch App</span>
              <ArrowRight className="h-4 w-4 text-white transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-16 md:pt-24">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.38em] text-brand-teal">
          {eyebrow}
        </p>

        {/* `text-balance`, like every title in the app. These two cannot be one
            line — "What we hold, and what we do not" needs about 1,150px at
            60px and the reading measure here is 896px — so the rule that
            applies is the other half of it: where a title must wrap, split it
            evenly rather than leaving two words alone. */}
        <h1 className="mt-6 font-sans text-4xl font-black leading-[1.05] tracking-tight text-balance text-brand-ink sm:text-5xl lg:text-6xl">
          {title}
        </h1>

        {/* Max 65ch — this is the one page on the site people read top to
            bottom rather than scan. */}
        <p className="mt-7 max-w-[62ch] text-lg font-medium leading-relaxed text-stone-600">
          {standfirst}
        </p>

        <p className="mt-8 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400">
          Last updated {updated}
        </p>

        {/* Reads its entries from the rendered headings below, so it cannot
            drift from them. Fixed rail on wide screens, inline list otherwise. */}
        <LegalToc />

        <div className="mt-14 flex flex-col gap-12">{children}</div>
      </main>

      <LandingFooter />
    </div>
  );
}

/** One numbered section. The number is what a person quotes back at you. */
export function LegalSection({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={`section-${n}`}
      className="scroll-mt-24 border-t border-stone-200 pt-10"
    >
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-[13px] font-bold tabular-nums text-brand-teal">
          {String(n).padStart(2, "0")}
        </span>
        <h2 className="font-sans text-2xl font-black tracking-tight text-balance text-brand-ink sm:text-3xl">
          {title}
        </h2>
      </div>

      <div className="mt-6 flex max-w-[68ch] flex-col gap-5 text-[15px] leading-[1.75] text-stone-700">
        {children}
      </div>
    </section>
  );
}

/** A bulleted list, sharing the section's measure and rhythm. */
export function LegalList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span
            aria-hidden
            className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-brand-teal"
          />
          <span className="min-w-0 break-words">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A pulled-out statement for the handful of things a reader must not miss —
 * that this is not the official source, and that a merit list is a public
 * record we republish rather than a file we collected.
 */
export function LegalCallout({
  id,
  title,
  children,
}: {
  /**
   * Optional anchor. The terms page's opening callout is the disclaimer the
   * footer links to by name, and a link called "Official Disclaimer" that lands
   * on the same URL as the one called "Terms of Service" is two labels for one
   * destination.
   */
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      // Clears the sticky header, the same 96px the numbered sections reserve.
      className="scroll-mt-24 rounded-3xl border border-stone-200/80 bg-brand-white p-6 sm:p-8"
    >
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.24em] text-brand-teal">
        {title}
      </p>
      <div className="mt-4 flex flex-col gap-4 text-[15px] leading-[1.75] text-stone-700">
        {children}
      </div>
    </div>
  );
}
