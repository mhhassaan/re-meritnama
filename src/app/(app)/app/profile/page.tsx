import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { essentials, loadMyProfile } from "@/lib/profile/data";
import { ProfileForm } from "@/components/profile/profile-form";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { Pill } from "@/components/portal/portal-terms";
import { AlertIcon, SealIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "My Profile | MeritNama",
  description: "Your account, what you are aiming for, and what is visible to anyone else.",
};

/** The portal's verification vocabulary, as every other page names it. */
const STATUS: Record<number, { label: string; tone: "safe" | "reach" | "danger" }> = {
  1: { label: "Accepted", tone: "safe" },
  2: { label: "Rejected", tone: "danger" },
  11: { label: "Pending", tone: "reach" },
};

/**
 * My Profile.
 *
 * The original's `candidate.html` is one long page mixing four different
 * things: what the gazette says about you, what you say about yourself, an
 * admin message inbox, and an invite generator. This is the first two, kept
 * visibly apart, because the difference between "verified" and "typed in"
 * is the only thing on the page that matters.
 *
 * What is deliberately not here yet is listed at the foot rather than omitted —
 * someone arriving from the original will look for it.
 */
export default async function ProfilePage() {
  const view = await loadMyProfile();
  if (!view) redirect("/auth?next=/app/profile");

  const list = essentials(view);
  const done = list.filter((e) => e.done).length;
  const strength = Math.round((done / list.length) * 100);

  const status =
    view.linked?.profileStatus != null ? STATUS[view.linked.profileStatus] : undefined;

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[1000px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Account</Eyebrow>

          <h1 className="mt-6 max-w-[16ch] font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl">
            My
            <span className="block text-accent">profile</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Signed in as{" "}
            <span className="font-mono text-foreground">{view.profile.email}</span>.
            Two different things live on this page and the difference matters:
            what the gazette says about you, which nobody can edit, and what you
            say about yourself, which is yours alone.
          </p>
        </Reveal>

        {/* ── Strength ─────────────────────────────────────────────────── */}
        <Bezel className="mt-12" innerClassName="p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
              Profile strength
            </p>
            <p className="font-mono text-sm tabular-nums text-fg-muted">
              <span className="text-lg font-bold text-foreground">{strength}%</span>{" "}
              · {done}/{list.length} done
            </p>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-sm bg-surface-sunken">
            <div
              className="h-full rounded-sm bg-accent-strong transition-[width] duration-[600ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
              style={{ width: `${strength}%` }}
            />
          </div>

          <ul className="mt-5 flex flex-col gap-2.5">
            {list.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                    item.done
                      ? "bg-status-safe/20 text-status-safe"
                      : "bg-surface-sunken text-fg-subtle"
                  }`}
                >
                  {item.done ? "✓" : "•"}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span
                      className={`font-sans text-sm font-bold ${
                        item.done ? "text-foreground" : "text-fg-muted"
                      }`}
                    >
                      {item.label}
                    </span>
                    {!item.actionable && (
                      <span className="font-mono text-[9px] uppercase tracking-wider text-fg-subtle">
                        not set here
                      </span>
                    )}
                    <span className="sr-only">{item.done ? "done" : "not done"}</span>
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-fg-subtle">
                    {item.note}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Bezel>

        {/* ── The gazette's record ─────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            Your Induction Portal record
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            Read-only, and not editable by anyone here. It arrives from the
            published gazette and the portal export.
          </p>

          {view.linked ? (
            <Bezel className="mt-5" innerClassName="p-6">
              <div className="flex flex-wrap items-center gap-3">
                <SealIcon className="h-4 w-auto shrink-0 text-status-safe" />
                <span className="font-sans text-base font-bold text-foreground">
                  {view.linked.nameFull}
                </span>
                {status ? (
                  <Pill tone={status.tone}>{status.label}</Pill>
                ) : (
                  <Pill tone="plain">No verification record</Pill>
                )}
              </div>

              <div className="mt-4 grid gap-px overflow-hidden rounded-sm bg-border sm:grid-cols-3">
                <Cell label="Applicant ID" value={String(view.linked.applicantId)} />
                <Cell label="Induction" value={String(view.linked.induction)} />
                <Cell label="Linked" value="Verified" tone="text-status-safe" />
              </div>

              <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
                An applicant id belongs to one cycle and no other — the same
                number is a different person next induction, so a new cycle
                needs verifying again.
              </p>
            </Bezel>
          ) : (
            <Bezel className="mt-5" innerClassName="flex items-start gap-3 p-5">
              <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
              <p className="text-sm leading-relaxed text-fg-muted">
                <span className="font-bold text-status-reach">Not linked yet.</span>{" "}
                Linking is done by verification rather than by typing an id:
                a single-use link is sent to the address already on your
                candidate record, so nobody can claim a record they do not hold.{" "}
                <Link href="/app" className="font-bold text-accent underline">
                  Start here
                </Link>
                .
              </p>
            </Bezel>
          )}
        </section>

        {/* ── What you say about yourself ──────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            About you
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            Self-asserted and editable at any time. Nothing here is checked
            against the gazette, and nothing here changes your merit position.
          </p>

          <ProfileForm profile={view.profile} facets={view.facets} />
        </section>

        {/* ── What the original has that this does not ─────────────────── */}
        <section className="mt-12">
          <Bezel innerClassName="p-6">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-fg-muted">
              Not built yet
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm leading-relaxed text-fg-muted">
              <NotYet label="Profile photo">
                Needs a storage bucket and its own access policy. The column
                exists; nothing writes it, and the account menu shows an initial
                rather than a broken image.
              </NotYet>
              <NotYet label="Message the admin">
                The original drafts a reply from a dataset keyed by applicant id
                — a lookup surface over grievance records, which needs its own
                decision before it is built.
              </NotYet>
              <NotYet label="Invite colleagues">
                Two invites per account, sharing a generated PIN. Our access
                model sends a single-use link to a known address instead, so this
                needs redesigning rather than porting.
              </NotYet>
              <NotYet label="Mentorship and chat">
                The first feature where one user writes something another reads,
                so it needs moderation, reporting and retention designed up
                front.
              </NotYet>
            </ul>
          </Bezel>
        </section>
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className={`mt-1 font-mono text-sm font-bold tabular-nums ${tone}`}>
        {value}
      </p>
    </div>
  );
}

function NotYet({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className="font-sans text-sm font-bold text-foreground">{label}</span>
      <Pill tone="plain">Soon</Pill>
      <span className="min-w-0 flex-1 basis-full text-xs leading-relaxed text-fg-subtle sm:basis-auto">
        {children}
      </span>
    </li>
  );
}
