import type { Tidbits } from "@/lib/portal/merit-list";
import { Bezel } from "@/components/app/bezel";
import { Pill } from "@/components/portal/portal-terms";

/**
 * The sidebar the portal calls Tidbits.
 *
 * Two lists that exist to explain movement that otherwise looks like a bug. A
 * candidate holding seats under both an Armed Force and a civilian quota, or in
 * two programmes, occupies more than one slot in the published list — and then
 * vanishes from all but one the moment they consent. Without knowing who those
 * people are, a reader watching a slot sees a leading candidate disappear for
 * no visible reason.
 *
 * The original prints each name with their father's name. That lives on
 * `candidates`, is Tier 2, and is published nowhere — so it is not shown here.
 * The applicant id already tells two similar names apart.
 */
export function TidbitsPanel({ tidbits }: { tidbits: Tidbits }) {
  const { multiTrack, multiProgramme } = tidbits;

  // The caller decides whether to render this at all, because the grid template
  // depends on it. Returning null from here left the main column in the
  // sidebar's 17rem track on any round with neither list.
  if (!multiTrack.length && !multiProgramme.length) return null;

  return (
    <Bezel innerClassName="p-5 xl:sticky xl:top-20">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
        Tidbits
      </p>
      <p className="mt-2 text-xs leading-relaxed text-fg-muted">
        Candidates who appear in more than one seat, and will leave all but one.
      </p>

      <Group
        title="Multi-track"
        hint="In both Armed Force and civilian"
        tone="danger"
        people={multiTrack}
      />
      <Group
        title="Multi-programme"
        hint="Placed in more than one programme"
        tone="reach"
        people={multiProgramme}
      />
    </Bezel>
  );
}

function Group({
  title,
  hint,
  tone,
  people,
}: {
  title: string;
  hint: string;
  tone: "danger" | "reach";
  people: Array<{ applicantId: number; name: string; programs: string[] }>;
}) {
  if (!people.length) return null;

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="flex items-baseline gap-2">
        <Pill tone={tone}>{title}</Pill>
        <span className="font-mono text-[10px] tabular-nums text-fg-subtle">
          {people.length}
        </span>
      </div>
      <p className="mt-1.5 font-mono text-[10px] text-fg-subtle">{hint}</p>

      <ul className="mt-3 flex flex-col gap-2.5">
        {people.map((person) => (
          <li key={person.applicantId} className="text-[13px] leading-snug">
            <span className="font-mono text-[10px] tabular-nums text-fg-subtle">
              {person.applicantId}
            </span>{" "}
            <span className="font-bold text-foreground">{person.name}</span>
            <span className="mt-0.5 block font-mono text-[10px] text-fg-subtle">
              {person.programs.join(" + ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
