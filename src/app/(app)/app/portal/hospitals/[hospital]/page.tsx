import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadHospital } from "@/lib/portal/hospitals";
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

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          {/* `Eyebrow` is an inline-flex span, so the back link needs its own
              block or the two share a line and read as one control. */}
          <div>
            <Link
              href="/app/portal/hospitals"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-fg-muted transition-colors hover:text-foreground"
            >
              <span aria-hidden>&larr;</span> All hospitals
            </Link>
          </div>

          <div className="mt-6">
            <Eyebrow>Induction Portal</Eyebrow>
          </div>

          <h1 className="mt-4 max-w-[22ch] font-sans text-[2rem] font-black leading-[1.05] tracking-[-0.03em] sm:text-5xl">
            {hospital.name}
          </h1>

          {hospital.institute && hospital.institute !== hospital.name && (
            <p className="mt-2 text-sm text-fg-muted">{hospital.institute}</p>
          )}

          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Training hospital profile, from the induction seat matrix.
          </p>
        </Reveal>

        <Bezel
          className="mt-10"
          innerClassName="grid grid-cols-2 gap-px bg-border sm:grid-cols-3"
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
            Largest first. A specialty with seats under more than one programme
            is contested separately in each — the allocation runs per programme.
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
            Quota decides which pool a seat is contested in, so two candidates
            with the same mark can face completely different competition at the
            same hospital.
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

        {/* ── Reviews, which are not built ─────────────────────────────── */}
        <section className="mt-12">
          <Bezel innerClassName="flex flex-wrap items-center gap-3 p-5">
            <MessagesIcon className="h-4 w-auto shrink-0 text-fg-subtle" />
            <p className="min-w-0 flex-1 text-sm leading-relaxed text-fg-muted">
              <span className="font-bold text-foreground">Training reviews</span>{" "}
              — the official portal ends this page with reviews written by
              residents, rated overall and per aspect. That is a community
              feature with its own writes and its own moderation, not a view over
              seat data, so it is not built here yet.
            </p>
            <Pill tone="plain">Soon</Pill>
          </Bezel>
        </section>

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            Seat counts are withdrawn and added between rounds as accreditation
            changes. Confirm against the official seat notification before
            choosing preferences on the strength of a count here.
          </span>
        </p>
      </div>
    </div>
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
    <div className="bg-surface p-3">
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
