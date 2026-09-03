import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loadPublicProfiles } from "@/lib/portal/profiles";
import { loadMyProfile } from "@/lib/profile/data";
import { ProfilesControls } from "@/components/portal/profiles-controls";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { HairlineCard, HairlineGrid } from "@/components/app/hairline-grid";
import { Pill } from "@/components/portal/portal-terms";
import { SpecialtyLabel } from "@/components/merit/merit-badges";
import { AlertIcon, CompassIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Community Profiles | Induction Portal | MeritNama",
  description:
    "Candidates who chose to be discoverable, with the specialty and hospital they are aiming for.",
};

/**
 * Community Profiles.
 *
 * The original's framing, kept: "Browse registered members who have shared
 * their profile. Data is self-reported and shown publicly by the user."
 *
 * A card carries three fields and no more — see `@/lib/portal/profiles` for
 * why that is fixed by a promise already printed on `/app/profile` rather
 * than by taste.
 */
export default async function ProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; specialty?: string; page?: string }>;
}) {
  const params = await searchParams;

  const [view, mine] = await Promise.all([
    loadPublicProfiles({
      search: params.q,
      specialty: params.specialty,
      page: Number(params.page) || 1,
    }),
    loadMyProfile(),
  ]);

  const from = (view.page - 1) * 24;

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Induction Portal</Eyebrow>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            Who else is{" "}
            <span className="text-accent">going for it</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Candidates who chose to be discoverable, and what they are
            aiming for. All self-reported.
          </p>
        </Reveal>

        {/* ── Your own row ────────────────────────────────────────────────── */}
        <Bezel className="mt-10" innerClassName="flex flex-wrap items-center gap-4 p-5">
          {mine?.profile.isPublic ? (
            <>
              <Pill tone="safe">You are listed</Pill>
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-fg-muted">
                Other verified candidates can see your display name, your photo
                if you added one, and your two goals. Nothing else about you
                appears here.
              </p>
            </>
          ) : (
            <>
              <Pill tone="plain">Not listed</Pill>
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-fg-muted">
                Your profile is private, which is the default. You can browse
                this page either way.
              </p>
            </>
          )}
          <Link
            href="/app/profile"
            className="shrink-0 rounded-sm border border-border-strong px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground"
          >
            Edit my profile
          </Link>
        </Bezel>

        <Suspense fallback={null}>
          <ProfilesControls
            specialties={view.specialties}
            selected={{
              search: params.q ?? "",
              specialty: params.specialty ?? "",
            }}
          />
        </Suspense>

        <p className="mt-6 font-mono text-[11px] text-fg-muted">
          <span className="font-bold text-foreground">
            {view.total.toLocaleString("en-GB")}
          </span>{" "}
          {view.total === 1 ? "profile" : "profiles"}
          {view.pageCount > 1 && (
            <>
              {" · showing "}
              {(from + 1).toLocaleString("en-GB")}&ndash;
              {(from + view.profiles.length).toLocaleString("en-GB")} (page{" "}
              {view.page} of {view.pageCount})
            </>
          )}
        </p>

        {view.profiles.length === 0 ? (
          <Bezel className="mt-3" innerClassName="px-8 py-20 text-center">
            <CompassIcon className="mx-auto h-8 w-auto text-fg-subtle" />
            <p className="mt-4 font-sans text-base font-bold text-foreground">
              {view.total === 0 && !params.q && !params.specialty
                ? "Nobody is listed yet"
                : "No profiles match"}
            </p>
            <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-fg-muted">
              {view.total === 0 && !params.q && !params.specialty
                ? "Discoverability is off by default, so this page fills up only as people choose to opt in."
                : "Try a different specialty, or clear the search."}
            </p>
          </Bezel>
        ) : (
          <HairlineGrid className="mt-3 auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
            {view.profiles.map((profile) => (
              <HairlineCard key={profile.key} className="flex h-full flex-col p-5">
                <div className="flex items-start gap-3">
                  {profile.avatarUrl ? (
                    /* Not `next/image`: a signed URL that expires within the
                       hour has nothing stable to optimise, and a remote pattern
                       for the storage host would let any object in it be
                       proxied through our own domain. */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatarUrl}
                      alt=""
                      aria-hidden
                      className="h-10 w-10 shrink-0 rounded-full border border-border-strong object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-quiet font-sans text-base font-black uppercase text-accent"
                    >
                      {profile.displayName.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-sans text-sm font-bold text-foreground">
                      {profile.displayName}
                    </p>
                    {profile.isMe && (
                      <span className="mt-1 inline-block font-mono text-[9px] uppercase tracking-wider text-hope">
                        you
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex min-h-[3rem] flex-col gap-1.5 border-t border-border pt-3">
                  {profile.specialtyGoal ? (
                    <SpecialtyLabel
                      specialty={profile.specialtyGoal}
                      className="text-[13px]"
                    />
                  ) : (
                    <p className="font-mono text-[10px] text-fg-subtle">
                      No specialty set
                    </p>
                  )}
                  {profile.hospitalGoal && (
                    <p className="truncate text-xs text-fg-muted">
                      {profile.hospitalGoal}
                    </p>
                  )}
                </div>
              </HairlineCard>
            ))}
          </HairlineGrid>
        )}

        <p className="mt-16 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            <span className="font-bold text-status-reach">
              A card is a name, a photo and two goals, deliberately.
            </span>{" "}
            Nothing derived from marks, preferences, or the applicant record. That is what the profile
            settings promise anyone who turns discoverability on, and the
            promise governs this page rather than the other way round. Names are
            typed by their owners and verified against nothing.
          </span>
        </p>
      </div>
    </div>
  );
}
