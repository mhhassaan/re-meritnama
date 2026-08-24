"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MyProfile } from "@/lib/profile/data";
import { saveProfile } from "@/lib/profile/actions";
import { Bezel } from "@/components/app/bezel";
import { FieldLabel, FieldHint, Select, TextField } from "@/components/app/field";
import { SaveIcon } from "@/components/ui/save";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * The editable half of My Profile.
 *
 * Everything here is **self-asserted**, and the page keeps it visually apart
 * from the gazette record above it. The original runs the two together, which
 * makes "aspiring specialty" look like the same class of fact as a verified
 * mark.
 *
 * Goals are selects over the real seat matrix rather than free text — see the
 * action for why that is about staying joinable rather than about safety.
 */
export function ProfileForm({
  profile,
  facets,
}: {
  profile: MyProfile;
  facets: { specialties: string[]; hospitals: string[] };
}) {
  const router = useRouter();
  const { ref: icon, handlers } = useActionIcon();

  const [displayName, setDisplayName] = useState(profile.displayName ?? "");
  const [specialtyGoal, setSpecialtyGoal] = useState(profile.specialtyGoal ?? "");
  const [hospitalGoal, setHospitalGoal] = useState(profile.hospitalGoal ?? "");
  const [isPublic, setIsPublic] = useState(profile.isPublic);

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await saveProfile({
        displayName,
        specialtyGoal,
        hospitalGoal,
        isPublic,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSaved(true);
      // Re-renders the server half of the page — the checklist and the trust
      // signals above are computed from what was just written.
      router.refresh();
    });
  }

  return (
    <Bezel className="mt-5" innerClassName="p-6">
      <form onSubmit={submit}>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-1 md:col-span-2">
            <FieldLabel htmlFor="p-name">Display name</FieldLabel>
            <TextField
              id="p-name"
              value={displayName}
              maxLength={60}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you want to be listed"
            />
            <FieldHint>
              Yours to choose, and not checked against anything. It is the only
              thing other candidates would see if you turn discovery on.
            </FieldHint>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="p-specialty">Aspiring specialty</FieldLabel>
            <Select
              id="p-specialty"
              value={specialtyGoal}
              onChange={(e) => setSpecialtyGoal(e.target.value)}
            >
              <option value="">Not set</option>
              {facets.specialties.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <FieldHint>Specialties with seats this cycle.</FieldHint>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="p-hospital">Aspiring hospital</FieldLabel>
            <Select
              id="p-hospital"
              value={hospitalGoal}
              onChange={(e) => setHospitalGoal(e.target.value)}
            >
              <option value="">Not set</option>
              {facets.hospitals.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
            <FieldHint>Optional — leave it if you are open on location.</FieldHint>
          </div>
        </div>

        {/* ── Visibility ──────────────────────────────────────────────── */}
        <div className="mt-6 border-t border-border pt-5">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-border-strong accent-[var(--accent-strong)]"
            />
            <span className="min-w-0">
              <span className="font-sans text-sm font-bold text-foreground">
                Make my profile discoverable
              </span>
              {/* Said plainly, and said here rather than in a policy page. The
                  default is off, and turning it on is the only thing on this
                  page that makes anything visible to anybody else. */}
              <span className="mt-1 block text-xs leading-relaxed text-fg-muted">
                Off by default. With it on, other verified candidates can see
                your display name and your two goals — and nothing else. Your
                email, your marks, your preferences and your applicant id are
                never part of it.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-border pt-5">
          <button
            type="submit"
            disabled={pending}
            {...handlers}
            className="group flex min-h-[46px] items-center gap-3 rounded-sm bg-accent-strong py-2 pl-5 pr-2 text-sm font-bold text-fg-on-accent shadow-ambient transition-all duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save profile"}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-[250ms] group-hover:translate-x-0.5">
              <SaveIcon ref={icon} size={ICON_SIZE_SM} />
            </span>
          </button>

          <p aria-live="polite" className="font-mono text-[11px]">
            {error ? (
              <span className="text-status-danger">{error}</span>
            ) : saved ? (
              <span className="text-status-safe">Saved.</span>
            ) : (
              <span className="text-fg-subtle">
                {profile.exists ? "" : "Nothing saved yet."}
              </span>
            )}
          </p>
        </div>
      </form>
    </Bezel>
  );
}
