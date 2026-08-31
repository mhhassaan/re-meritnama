"use client";

import type { JoiningSlot } from "@/lib/portal/joining";
import { SpecialtyLabel } from "@/components/merit/merit-badges";
import { Pill } from "@/components/portal/portal-terms";
import { useIdentifiedApplicant } from "@/components/portal/find-me-bar";
import { formatDate } from "@/lib/format/date";

/**
 * One seat, and who reported to it.
 *
 * The original's card: seat heading, a count and an "All joined" pill on the
 * right, then a row per candidate with id, name, mark, preference number and a
 * joined-or-pending pill carrying the date.
 *
 * The date needs saying carefully. The export uses **one field** for two
 * different facts: for someone who joined it is the day they did, and for
 * someone still pending it is the day by which they had to. Printing "Joined ·
 * 3 Jun" against a person who has not joined would be flatly wrong, so the
 * label changes with the state.
 */
export function JoiningSlotCard({ slot }: { slot: JoiningSlot }) {
  const me = useIdentifiedApplicant();

  const all = slot.people.length;
  const allJoined = slot.joined === all;

  return (
    // A row in the hairline stack on the joining page: opaque, so the seam
    // colour shows only between rows. 679 of these were 679 boxes.
    <div className="bg-background p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <SpecialtyLabel specialty={slot.specialty} className="text-[13px]" />
          <p className="mt-1 text-xs leading-snug text-fg-muted">{slot.hospital}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
            {slot.program} · {slot.quota}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-[11px] tabular-nums text-fg-muted">
            {all} {all === 1 ? "candidate" : "candidates"}
          </span>
          {allJoined ? (
            <Pill tone="safe">All joined</Pill>
          ) : (
            <Pill tone="reach">
              {slot.joined}/{all} joined
            </Pill>
          )}
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5">
        {slot.people.map((person) => {
          const isMe = person.applicantId === me;
          return (
            <li
              key={person.applicantId}
              className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-1 rounded-sm text-[13px] ${
                isMe ? "-mx-1.5 bg-hope/10 px-1.5 py-0.5 ring-1 ring-hope/40" : ""
              }`}
            >
              <span className="font-mono text-[10px] tabular-nums text-fg-subtle">
                {person.applicantId}
              </span>

              <span className="min-w-0 flex-1 truncate font-bold text-foreground">
                {person.name ?? `Applicant ${person.applicantId}`}
                {isMe && (
                  <span className="ml-1.5 font-mono text-[9px] uppercase tracking-wider text-hope">
                    you
                  </span>
                )}
              </span>

              <span className="font-mono text-xs font-bold tabular-nums text-accent">
                {person.marks != null ? person.marks.toFixed(2) : "—"}
              </span>

              <span className="font-mono text-[10px] text-fg-subtle">
                P{person.preferenceNo ?? "—"}
              </span>

              <Pill tone={person.joined ? "safe" : "reach"}>
                {person.joined ? "Joined" : "Not joined"}
                {person.date && (
                  <>
                    {" · "}
                    {formatDate(person.date)}
                  </>
                )}
              </Pill>
            </li>
          );
        })}
      </ul>

      {slot.joined < all && (
        <p className="mt-3 font-mono text-[10px] leading-snug text-fg-subtle">
          The date against a candidate who has not joined is their{" "}
          <span className="text-status-reach">deadline</span>, not a joining
          date — the export records both in one field.
        </p>
      )}
    </div>
  );
}
