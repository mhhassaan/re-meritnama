"use client";

import { useState } from "react";
import type { MeritSlot, QueueEntry, QueueTag } from "@/lib/portal/merit-list";
import { Bezel } from "@/components/app/bezel";
import { SpecialtyLabel } from "@/components/merit/merit-badges";
import { Pill } from "@/components/portal/portal-terms";
import { useSimulation } from "@/components/portal/simulation-provider";
import { useIdentifiedApplicant } from "@/components/portal/find-me-bar";
import { ChevronDownIcon } from "@/components/ui/chevron-down";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * One seat, its occupants, and the queue behind it.
 *
 * The card is the portal's unit of attention: a candidate looks at the seat
 * they want and asks who is in it and who else is waiting. Occupants come
 * first, ordered so the people actually holding the seat are at the top; the
 * queue is collapsed, because it can run to hundreds and is a second question.
 *
 * The queue is rendered client-side only when opened. It is already in the
 * payload — the card cannot know whether it will be opened, and refetching per
 * card would be far more expensive than the markup it saves.
 */

const TAG_LABEL: Record<QueueTag, string> = {
  fresh: "Fresh placement",
  upgrade: "Upgrade chance",
  "higher-pref": "At higher pref — won't move",
  "locked-other-programme": "Locked to other programme",
};

const TAG_TONE: Record<QueueTag, "safe" | "reach" | "plain" | "danger"> = {
  fresh: "safe",
  upgrade: "reach",
  "higher-pref": "plain",
  "locked-other-programme": "danger",
};

export function MeritSlotCard({ slot }: { slot: MeritSlot }) {
  const [open, setOpen] = useState(false);
  const { ref: icon, handlers } = useActionIcon();
  const { stateFor } = useSimulation();
  const me = useIdentifiedApplicant();

  const seatKey = `${slot.program}|${slot.specialty}|${slot.hospital}|${slot.quota}`;

  // Split on the EDITED state, not the published one, so a pill toggled to
  // Excluded moves down to Vacated immediately — the card has to reflect the
  // decision being modelled or the reader cannot see what they just did.
  const current = (o: MeritSlot["occupants"][number]) =>
    stateFor(o.applicantId, seatKey, o.consent);

  const held = slot.occupants.filter((o) => current(o) === "Accepted");
  const vacated = slot.occupants.filter((o) => current(o) !== "Accepted");

  return (
    <Bezel innerClassName="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SpecialtyLabel specialty={slot.specialty} className="text-[13px]" />
          <p className="mt-1 text-xs leading-snug text-fg-muted">{slot.hospital}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fg-subtle">
            {slot.program} · {slot.quota}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`rounded-sm border px-2 py-1 font-mono text-[11px] font-bold tabular-nums ${
              held.length >= slot.capacity
                ? "border-status-safe/50 text-status-safe"
                : "border-status-reach/50 text-status-reach"
            }`}
            title={
              held.length >= slot.capacity
                ? "Every seat is held"
                : `${slot.capacity - held.length} seat${slot.capacity - held.length === 1 ? "" : "s"} open`
            }
          >
            {held.length}/{slot.capacity}
          </span>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            {...handlers}
            className="flex items-center gap-1.5 rounded-sm border border-border-strong px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground"
          >
            Next in line
            <ChevronDownIcon
              ref={icon}
              size={ICON_SIZE_SM}
              className={`transition-transform duration-[200ms] ${
                open ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3">
        {held.map((person) => (
          <OccupantRow
            key={`${person.applicantId}-held`}
            person={person}
            seatKey={seatKey}
            isMe={person.applicantId === me}
          />
        ))}
        {held.length === 0 && (
          <li className="font-mono text-[11px] text-fg-subtle">
            Nobody is holding this seat.
          </li>
        )}
      </ul>

      {vacated.length > 0 && (
        <>
          <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.18em] text-fg-muted">
            Vacated
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {vacated.map((person) => (
              <OccupantRow
                key={`${person.applicantId}-vacated`}
                person={person}
                seatKey={seatKey}
                isMe={person.applicantId === me}
                dimmed
              />
            ))}
          </ul>
        </>
      )}

      {open && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
            Next in line ({slot.queueLength.toLocaleString("en-GB")})
          </p>
          <p className="mt-1 font-mono text-[10px] text-fg-subtle">
            {slot.available.toLocaleString("en-GB")} could take this seat
          </p>

          {slot.queue.length === 0 ? (
            <p className="mt-3 font-mono text-[11px] text-fg-subtle">
              Nobody else listed this seat.
            </p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2.5">
              {/* Already truncated server-side — the full queue is never sent.
                  The honest length is stated above. */}
              {slot.queue.map((entry, i) => (
                <QueueRow key={entry.applicantId} entry={entry} position={i + 1} />
              ))}
            </ol>
          )}

          {slot.queueLength > slot.queue.length && (
            <p className="mt-3 font-mono text-[10px] text-fg-subtle">
              Showing the first {slot.queue.length} of{" "}
              {slot.queueLength.toLocaleString("en-GB")}, ranked by the mark that
              applies to this seat.
            </p>
          )}
        </div>
      )}
    </Bezel>
  );
}

function OccupantRow({
  person,
  seatKey,
  isMe = false,
  dimmed = false,
}: {
  person: MeritSlot["occupants"][number];
  seatKey: string;
  isMe?: boolean;
  dimmed?: boolean;
}) {
  const { stateFor, cycle, isEdited } = useSimulation();

  const state = stateFor(person.applicantId, seatKey, person.consent);
  const edited = isEdited(person.applicantId, seatKey);

  return (
    <li
      // Identified rows keep full opacity even when vacated: the whole point of
      // finding yourself is that your own row never fades into the background.
      className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-sm text-[13px] ${
        dimmed && !isMe ? "opacity-55" : ""
      } ${isMe ? "-mx-1.5 bg-hope/10 px-1.5 py-0.5 ring-1 ring-hope/40" : ""}`}
    >
      <span className="font-mono text-[10px] tabular-nums text-fg-subtle">
        {person.applicantId}
      </span>
      <span className="min-w-0 flex-1 truncate font-bold text-foreground">
        {person.name}
        {isMe && (
          <span className="ml-1.5 font-mono text-[9px] uppercase tracking-wider text-hope">
            you
          </span>
        )}
      </span>
      <span className="font-mono text-xs font-bold tabular-nums text-accent">
        {person.mark != null ? person.mark.toFixed(2) : "—"}
      </span>
      <span className="font-mono text-[10px] text-fg-subtle">
        P{person.preferenceNo ?? "—"}
      </span>

      {/* A real button, not a styled span: it changes state, so it has to be
          reachable and operable from the keyboard like anything else that
          does. */}
      <button
        type="button"
        onClick={() => cycle(person.applicantId, seatKey, person.consent)}
        title={
          edited
            ? `Edited — published as ${person.consent}. Click to cycle.`
            : `${state}. Click to model a different decision.`
        }
        className={`rounded-sm transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          // An edited pill is ringed, so a modelled decision never reads as
          // something the gazette published.
          edited ? "ring-2 ring-accent ring-offset-1 ring-offset-[var(--surface)]" : ""
        }`}
      >
        <Pill
          tone={state === "Accepted" ? "safe" : state === "Awaited" ? "reach" : "danger"}
        >
          {state}
        </Pill>
      </button>

      <Pill tone={person.track === "armed" ? "reach" : "accent"}>
        {person.track === "armed" ? "Armed" : "Civilian"}
      </Pill>
    </li>
  );
}

function QueueRow({ entry, position }: { entry: QueueEntry; position: number }) {
  return (
    <li
      className={`flex flex-col gap-1 ${
        // Dimmed for anyone who will not move — the live portal does the same,
        // and it is the difference between a queue and a list of names.
        entry.tag === "higher-pref" || entry.tag === "locked-other-programme"
          ? "opacity-55"
          : ""
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
        <span className="font-mono text-[10px] font-bold tabular-nums text-fg-subtle">
          Q{position}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-fg-subtle">
          {entry.applicantId}
        </span>
        <span className="min-w-0 flex-1 truncate">
          {entry.name ? (
            <span className="font-bold text-foreground">{entry.name}</span>
          ) : (
            <span
              className="font-mono text-xs text-fg-muted"
              title="Not named in any published merit list"
            >
              unnamed
            </span>
          )}
        </span>
        <span className="font-mono text-xs font-bold tabular-nums text-accent">
          {entry.mark.toFixed(2)}
        </span>
        <span className="font-mono text-[10px] text-fg-subtle">
          P{entry.preferenceNo}
        </span>
      </div>

      {entry.placedAt && (
        <p className="font-mono text-[10px] leading-snug text-fg-subtle">
          P{entry.placedAt.preferenceNo} at {entry.placedAt.specialty} @{" "}
          {entry.placedAt.hospital} ({entry.placedAt.program},{" "}
          {entry.placedAt.quota})
        </p>
      )}

      <div>
        <Pill tone={TAG_TONE[entry.tag]}>{TAG_LABEL[entry.tag]}</Pill>
      </div>
    </li>
  );
}
