import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadHospital } from "@/lib/portal/hospitals";
import { loadHospitalReviews } from "@/lib/community/reviews";
import { loadPostingRights } from "@/lib/community/data";
import { ReviewComposer } from "@/components/community/review-composer";
import { StarsRead } from "@/components/community/stars";
import {
  AuthorLine,
  Chip,
  HiddenNotice,
  PostingGate,
} from "@/components/community/community-bits";
import { ReportButton } from "@/components/community/report-button";
import { ShortlistDrawer, ShortlistStar } from "@/components/portal/shortlist";
import { WithdrawButton } from "@/components/community/reply-composer";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { Pill } from "@/components/portal/portal-terms";
import { SpecialtyLabel } from "@/components/merit/merit-badges";
import { AlertIcon, MessagesIcon } from "@/components/icons/koboyo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hospital: string }>;
}): Promise<Metadata> {
  const { hospital: slug } = await params;
  const hospital = await loadHospital(slug);

  return {
    title: hospital
      ? `${hospital.name} | Hospitals | MeritNama`
      : "Hospital | MeritNama",
    description: hospital
      ? `Seat breakdown by specialty and programme for ${hospital.name}.`
      : undefined,
  };
}

/**
 * One hospital's profile.
 *
 * The original's page: three headline figures, then "Seat Distribution by
 * Specialty" as a table of specialty against programme, sorted by total.
 *
 * Its columns are hardcoded FCPS / MS / MD. Ours are the programmes the
 * hospital actually trains, so a dental institute shows dentistry rather than
 * three empty columns — the seat matrix has five programmes and the original's
 * table can only ever show three of them.
 */
export default async function HospitalProfilePage({
  params,
}: {
  params: Promise<{ hospital: string }>;
}) {
  const { hospital: slug } = await params;
  const hospital = await loadHospital(slug);

  // A slug that matches no hospital is a 404, not an empty page. The seat
  // matrix is the whole source of truth here, so "not in it" means "not a
  // training hospital this cycle".
  if (!hospital) notFound();

  // Fetched after the 404 check, and keyed on the hospital's real name rather
  // than the slug: the slug is our addressing scheme, the name is what a review
  // is written against.
  const [reviews, rights] = await Promise.all([
    loadHospitalReviews(hospital.name),
    loadPostingRights(),
  ]);

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          {/* `Eyebrow` is an inline-flex span, so the back link needs its own
              block or the two share a line and read as one control. */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href="/app/portal/hospitals"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-fg-muted transition-colors hover:text-foreground"
            >
              <span aria-hidden>&larr;</span> All hospitals
            </Link>
            <ShortlistDrawer />
          </div>

          <div className="mt-6">
            <Eyebrow>Induction Portal</Eyebrow>
          </div>

          <div className="mt-4 flex items-start gap-3">
            <h1 className="max-w-[22ch] font-sans text-[2rem] font-black leading-[1.05] tracking-[-0.03em] text-balance sm:text-5xl">
              {hospital.name}
            </h1>
            {/* Beside the name, where the original puts it. */}
            <ShortlistStar
              item={{
                id: `hospital:${hospital.slug}`,
                type: "hospital",
                label: hospital.name,
                href: `/app/portal/hospitals/${hospital.slug}`,
                meta: `${hospital.seats} seats · ${hospital.programs.join(", ")}`,
              }}
              className="mt-1 text-2xl"
            />
          </div>

          {hospital.institute && hospital.institute !== hospital.name && (
            <p className="mt-2 text-sm text-fg-muted">{hospital.institute}</p>
          )}

          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Training hospital profile, from the induction seat matrix.
          </p>
        </Reveal>

        <Bezel
          className="mt-10"
          innerClassName="grid grid-cols-2 overflow-clip sm:grid-cols-3"
        >
          <Meta label="Total seats" value={hospital.seats.toLocaleString("en-GB")} />
          <Meta label="Specialties" value={String(hospital.rows.length)} />
          <Meta label="Programmes" value={hospital.programs.join(", ")} mono={false} />
        </Bezel>

        {/* ── Seat distribution ─────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-lg font-bold text-foreground">
            Seat distribution by specialty
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            Largest first. A specialty running under two programmes is
            contested separately in each.
          </p>

          <Bezel className="mt-5" innerClassName="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <Th>Specialty</Th>
                  {hospital.programs.map((program) => (
                    <Th key={program} className="w-24 text-right">
                      {program}
                    </Th>
                  ))}
                  <Th className="w-20 text-right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {hospital.rows.map((row) => (
                  <tr
                    key={row.specialty}
                    className="border-b border-border/60 last:border-b-0"
                  >
                    <Td>
                      <SpecialtyLabel
                        specialty={row.specialty}
                        className="text-[13px]"
                      />
                    </Td>
                    {hospital.programs.map((program) => (
                      <Td
                        key={program}
                        className="text-right font-mono text-xs tabular-nums"
                      >
                        {/* An em dash, not a zero. There is no seat there to
                            compete for, which is a different fact from a seat
                            that exists and is empty. */}
                        {row.byProgram[program] ? (
                          <span className="text-foreground">
                            {row.byProgram[program]}
                          </span>
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </Td>
                    ))}
                    <Td className="text-right font-mono text-xs font-bold tabular-nums text-accent">
                      {row.total}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Bezel>
        </section>

        {/* ── Quotas ───────────────────────────────────────────────────── */}
        <section className="mt-10">
          <h2 className="font-sans text-lg font-bold text-foreground">
            Seats by quota
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
            Quota decides which pool a seat is contested in.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {hospital.quotas.map((q) => (
              <Bezel key={q.quota} innerClassName="flex items-baseline gap-2 px-4 py-2.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                  {q.quota}
                </span>
                <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                  {q.seats}
                </span>
              </Bezel>
            ))}
          </div>
        </section>

        {/* ── Training reviews ─────────────────────────────────────────
            The original's page ends here too. These are `community_posts` with
            `kind = 'hospital_review'`, so they arrive with the same authorship
            trigger, rate limit, reporting and moderation as everything else
            people write on this site — the section is a view, not a feature. */}
        <section className="mt-12">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-fg-muted">
            Training reviews
          </h2>

          {reviews.summary.count === 0 ? (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-muted">
              Nobody has reviewed {hospital.name} yet. A seat table says what is
              on offer; only somebody who trained here can say what it was like.
            </p>
          ) : (
            <Bezel className="mt-3" innerClassName="p-5">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
                    Overall
                  </p>
                  <StarsRead
                    value={reviews.summary.overall}
                    size="text-lg"
                    className="mt-1"
                  />
                  <p className="mt-1 font-mono text-[10px] text-fg-subtle">
                    {reviews.summary.count}{" "}
                    {reviews.summary.count === 1 ? "review" : "reviews"}
                  </p>
                </div>

                {/* Each aspect is optional, so an unrated one prints "not
                    rated" rather than a zero — a zero here would read as the
                    worst possible score instead of an absent one. */}
                <div className="flex flex-col gap-1.5">
                  <Aspect label="Teaching" value={reviews.summary.teaching} />
                  <Aspect label="Work-life balance" value={reviews.summary.balance} />
                  <Aspect label="Seniors' support" value={reviews.summary.seniors} />
                </div>
              </div>
            </Bezel>
          )}

          <PostingGate rights={rights} />
          {rights.canPost && (
            <ReviewComposer
              hospital={hospital.name}
              specialties={hospital.rows.map((r) => r.specialty)}
              alreadyReviewed={reviews.mine}
            />
          )}

          {reviews.reviews.length > 0 && (
            <div className="mt-6 flex flex-col gap-3">
              {reviews.reviews.map((review) => (
                <Bezel key={review.id} innerClassName="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StarsRead value={review.rating} />
                    {review.specialty && <Chip>{review.specialty}</Chip>}
                    {review.trainingYear && <Chip>Trained {review.trainingYear}</Chip>}
                  </div>

                  <p className="mt-3 break-words font-sans text-sm font-bold leading-snug text-foreground">
                    {review.title}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted break-words">
                    {review.body}
                  </p>

                  {(review.teaching || review.balance || review.seniors) && (
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-border pt-3">
                      {review.teaching && <Aspect label="Teaching" value={review.teaching} />}
                      {review.balance && <Aspect label="Balance" value={review.balance} />}
                      {review.seniors && <Aspect label="Seniors" value={review.seniors} />}
                    </div>
                  )}

                  <HiddenNotice moderation={review.moderation} />

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                    <AuthorLine author={review.author} at={review.createdAt} />
                    <div className="flex items-center gap-4">
                      {review.author.isMe && !review.moderation.hidden && (
                        <WithdrawButton target="post" targetId={review.id} />
                      )}
                      {!review.author.isMe && (
                        <ReportButton target="post" targetId={review.id} />
                      )}
                    </div>
                  </div>
                </Bezel>
              ))}
            </div>
          )}
        </section>

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            Seat counts change between rounds. Confirm against the official
          seat notification before choosing preferences.
          </span>
        </p>
      </div>
    </div>
  );
}

/** One aspect average, or an honest "not rated". */
function Aspect({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </span>
      <StarsRead value={value} size="text-xs" />
    </span>
  );
}

function Meta({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="-ml-px -mt-px border-l border-t border-border bg-surface p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-bold text-foreground ${
          mono ? "font-mono tabular-nums" : "font-sans text-base"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-fg-muted ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-2.5 text-[13px] ${className}`}>{children}</td>;
}
