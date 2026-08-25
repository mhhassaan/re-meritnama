"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { HospitalSummary } from "@/lib/portal/hospitals";
import { Bezel } from "@/components/app/bezel";
import { ShortlistDrawer, ShortlistStar } from "@/components/portal/shortlist";
import { FieldLabel, SearchField } from "@/components/app/field";
import { LoadMore } from "@/components/portal/load-more";
import { HouseIcon } from "@/components/icons/koboyo";
import { familyOf, FAMILY_CLASSES, FAMILY_LABELS } from "@/lib/design/specialty";

/**
 * The Hospital Directory — the original's card grid.
 *
 * Filtering is client-side and stays that way: 69 hospitals with their specialty
 * lists is a few tens of kilobytes, it carries nothing about any person, and a
 * round trip per keystroke would be slower for no benefit. The rule that sent
 * the Candidate Pool roster to the database is about a table nobody may return
 * whole; this is a public seat matrix.
 *
 * Searching matches the specialty list too, because "who trains Cardiology" is
 * the question this page is opened with at least as often as a hospital's name.
 *
 * ## Why every card is the same height
 *
 * The first version printed the whole specialty list as running text. Mayo has
 * 28 specialties and a district hospital has four, so cards in the same row
 * differed by a factor of five — and a grid row is as tall as its tallest cell,
 * which left a block of dead space under every short card and a different
 * amount under each. That reads as a rendering fault rather than as data.
 *
 * Two things fix it together: `auto-rows-fr` makes both cells in a row share a
 * height, and the specialty area is a **fixed-height** chip cloud, so the
 * content stops varying in the first place. Nothing is dropped — every chip is
 * in the DOM, the count is stated, and the profile lists all of them against
 * their seats.
 */
const BATCH = 24;

/** Chips shown before the cloud is clipped. Two rows at the card's width. */
const CHIP_AREA = "h-[3.75rem]";

export function HospitalDirectory({
  hospitals,
  ratings,
}: {
  hospitals: HospitalSummary[];
  /** Average rating and count per hospital name, for the ones that have any. */
  ratings: Record<string, { average: number; count: number }>;
}) {
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(BATCH);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return hospitals;
    return hospitals.filter(
      (h) =>
        h.name.toLowerCase().includes(term) ||
        h.institute?.toLowerCase().includes(term) ||
        h.specialties.some((s) => s.toLowerCase().includes(term)) ||
        h.programs.some((p) => p.toLowerCase().includes(term))
    );
  }, [hospitals, search]);

  // Searching resets the batch. Narrowing to four hospitals and still being
  // offered "Load more" reads as the filter having failed.
  const signature = search.trim().toLowerCase();
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setShown(BATCH);
  }

  return (
    <>
      <Bezel className="mt-8" innerClassName="p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <FieldLabel htmlFor="hosp-search">Search</FieldLabel>
            <SearchField
              id="hosp-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hospital, institute, specialty or programme…"
            />
          </div>
          <ShortlistDrawer />
        </div>
      </Bezel>

      <p className="mt-6 font-mono text-[11px] text-fg-muted">
        <span className="font-bold text-foreground">
          {visible.length.toLocaleString("en-GB")}
        </span>{" "}
        of {hospitals.length.toLocaleString("en-GB")} hospitals
      </p>

      {visible.length === 0 ? (
        <Bezel className="mt-3" innerClassName="px-8 py-20 text-center">
          <HouseIcon className="mx-auto h-8 w-auto text-fg-subtle" />
          <p className="mt-4 font-sans text-base font-bold text-foreground">
            No hospitals match
          </p>
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
            Try a specialty name, or clear the search.
          </p>
        </Bezel>
      ) : (
        <>
          {/* `auto-rows-fr`: both cells in a row take the same height, so a
              short card never leaves a gap beneath it. */}
          <div className="mt-3 grid auto-rows-fr gap-4 lg:grid-cols-2">
            {visible.slice(0, shown).map((hospital) => (
              <HospitalCard
                key={hospital.slug}
                hospital={hospital}
                rating={ratings[hospital.name]}
              />
            ))}
          </div>

          <LoadMore
            shown={Math.min(shown, visible.length)}
            total={visible.length}
            noun="hospitals"
            onClick={() => setShown((n) => n + BATCH)}
          />
        </>
      )}
    </>
  );
}

function HospitalCard({
  hospital,
  rating,
}: {
  hospital: HospitalSummary;
  rating?: { average: number; count: number };
}) {
  const largest = Math.max(...hospital.seatsByProgram.map((p) => p.seats), 1);

  return (
    <Link
      href={`/app/portal/hospitals/${hospital.slug}`}
      className="group block h-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Bezel innerClassName="flex h-full flex-col p-5 transition-colors duration-[200ms] group-hover:bg-surface-sunken">
        {/* ── Identity, on a fixed two lines ───────────────────────────── */}
        <div className="flex min-h-[2.75rem] items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 font-sans text-[15px] font-bold leading-snug text-accent">
              {hospital.name}
            </p>
            <p className="line-clamp-1 text-xs leading-snug text-fg-subtle">
              {hospital.institute && hospital.institute !== hospital.name
                ? hospital.institute
                : " "}
            </p>
          </div>

          {/* Inside a card that is itself a link, so the star stops the click
              before it bubbles — otherwise saving a hospital opens it. */}
          <ShortlistStar
            item={{
              id: `hospital:${hospital.slug}`,
              type: "hospital",
              label: hospital.name,
              href: `/app/portal/hospitals/${hospital.slug}`,
              meta: `${hospital.seats} seats · ${hospital.programs.join(", ")}`,
            }}
            className="-mr-1 -mt-1"
          />
        </div>

        {/* ── The two numbers, read rather than counted ────────────────── */}
        <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-y border-border py-3">
          <Stat value={hospital.seats} label={hospital.seats === 1 ? "seat" : "seats"} />
          <Stat
            value={hospital.specialties.length}
            label={hospital.specialties.length === 1 ? "specialty" : "specialties"}
          />

          {/* Only when somebody has actually reviewed it. A card that always
              showed a rating slot would print an empty score for 68 of 69
              hospitals, which reads as a bad rating rather than as no data. */}
          {rating && (
            <span className="flex items-baseline gap-1.5">
              <span
                aria-hidden
                className="text-sm leading-none tracking-[0.06em] text-status-reach"
              >
                {"★".repeat(Math.round(rating.average))}
              </span>
              <span className="font-mono text-[13px] font-bold tabular-nums text-foreground">
                {rating.average.toFixed(1)}
              </span>
              <span className="font-mono text-[10px] text-fg-subtle">
                {rating.count} {rating.count === 1 ? "review" : "reviews"}
              </span>
            </span>
          )}
        </div>

        {/* ── Seats by programme, as a bar ─────────────────────────────── */}
        {/* "FCPS, MS, MD" says a hospital trains three programmes. This says
            whether it is overwhelmingly one of them, which is what decides
            whether a preference there is worth spending. */}
        <ul className="mt-3 flex flex-col gap-1.5">
          {hospital.seatsByProgram.map(({ program, seats }, i) => (
            <li key={program} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate font-mono text-[10px] uppercase tracking-wider text-fg-muted">
                {program}
              </span>
              <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-surface-sunken">
                <span
                  className="block h-full rounded-sm"
                  style={{
                    width: `${(seats / largest) * 100}%`,
                    // Token, never a raw hex — the rule every chart here follows.
                    // Clamped at both ends. There are five programmes and five
                    // steps today, but a sixth would index `--chart-scale-00`,
                    // which does not exist and resolves to transparent — an
                    // invisible bar rather than a visible mistake.
                    background: `var(--chart-scale-0${Math.min(5, Math.max(1, 5 - i))})`,
                  }}
                />
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                {seats}
              </span>
            </li>
          ))}
        </ul>

        {/* ── Specialties, as chips ────────────────────────────────────── */}
        {/* Fixed height, so the card cannot grow with the list. Every chip is
            rendered — the clip is visual, the data is not truncated — and the
            profile prints all of them against their seat counts. */}
        <div className="mt-auto pt-4">
          <div
            className={`relative ${CHIP_AREA} overflow-hidden`}
            style={{
              maskImage:
                "linear-gradient(to bottom, black 62%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to bottom, black 62%, transparent 100%)",
            }}
          >
            <ul className="flex flex-wrap gap-1">
              {hospital.specialties.map((specialty) => (
                <SpecialtyChip key={specialty} specialty={specialty} />
              ))}
            </ul>
          </div>

          <p className="mt-1 font-mono text-[10px] text-fg-subtle">
            {hospital.specialties.length} in total · open for the full breakdown
          </p>
        </div>
      </Bezel>
    </Link>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-mono text-xl font-bold tabular-nums text-foreground">
        {value}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
        {label}
      </span>
    </span>
  );
}

/**
 * One specialty, coloured by its discipline family.
 *
 * The family palette is what the rest of the app already uses for a specialty,
 * so a reader who has seen the merit table recognises the colour before they
 * read the word. `title` carries the family name, which the chip has no room
 * for.
 */
function SpecialtyChip({ specialty }: { specialty: string }) {
  const family = familyOf(specialty);
  const classes = FAMILY_CLASSES[family];

  return (
    <li>
      <span
        title={`${specialty} — ${FAMILY_LABELS[family]}`}
        className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] leading-none ${classes.border} ${classes.text}`}
      >
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${classes.bg}`} />
        {specialty}
      </span>
    </li>
  );
}
