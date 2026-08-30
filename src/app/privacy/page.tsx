import type { Metadata } from "next";
import Link from "next/link";

import {
  LegalCallout,
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | MeritNama",
  description:
    "What MeritNama holds about you, who can see it, what never leaves your browser, and how to have it removed.",
};

/**
 * The privacy policy, written against what the code actually does.
 *
 * Every claim on this page is one that can be checked in this repository — the
 * tier split, the private avatar bucket, the absence of any analytics
 * dependency, the list of `localStorage` keys. Nothing here is aspirational,
 * because a policy describing an intention rather than a behaviour is the thing
 * that eventually becomes a lie.
 *
 * The two facts a reader most needs are pulled out of the numbered sections:
 * the merit list is a public record we republish rather than a file we
 * collected from anybody, and account data is deliberately small.
 *
 * Static, and reachable signed out — a privacy policy behind a login is not a
 * privacy policy.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="What we hold, and what we do not"
      standfirst="MeritNama is built around one rule: the data that decides careers is already published, and everything else about you stays where it was. This page says what that means in practice."
      updated="30 August 2026"
    >
      <LegalCallout title="Read this first">
        <p>
          Most of what you see on MeritNama was <strong>not collected from
          you</strong>. Merit lists, cutoffs, seat matrices and joining figures
          are published by the Punjab Health Foundation as part of the induction
          process. We read those published records, check them, and present them
          in a way you can actually use. Your name appearing on a merit list here
          is your name appearing on a merit list — we are not the publisher of
          it.
        </p>
        <p>
          Separately, if you create an account, you give us a small amount of
          information about yourself. That is section 02, and it is deliberately
          small.
        </p>
      </LegalCallout>

      <LegalSection n={1} title="Published induction records">
        <p>
          The Punjab Health Foundation publishes a gazette merit list for each
          induction round. It carries, for every candidate placed, their name,
          applicant id, PMDC registration number, marks, programme, specialty,
          hospital, quota and preference number. We hold a copy of those
          published records for the cycles we cover, alongside the seat matrix,
          the schedule, and CPSP’s accreditation register.
        </p>
        <p>
          These records are shown to <strong>signed-in, verified users
          only</strong>. That is not a legal requirement — the source is
          public — it is a deliberate narrowing, and it matches how the induction
          portal has always worked.
        </p>
        <p>
          Three things that appear in the source files are{" "}
          <strong>removed before they are stored</strong>, so they are not on
          this site at all:
        </p>
        <LegalList
          items={[
            <>
              <strong>Parentage.</strong> The portal writes fathers’ names
              into the name field. The gazette itself prints none, and neither do
              we — a name is stripped back to the candidate’s own before it
              is saved.
            </>,
            <>
              <strong>Names that are actually identity numbers.</strong> A
              handful of people typed their CNIC into the name box. Those names
              are withheld entirely and the person shows as their applicant id.
            </>,
            <>
              <strong>Employment details collected at joining.</strong> Grade,
              department, designation and province are in the source export.
              None of it is part of the gazette, so none of it is ingested.
            </>,
          ]}
        />
        <p>
          Candidates who applied but were never placed are shown as an applicant
          id and never as a name. Nobody has published those names, and this site
          is not going to be the first to.
        </p>
      </LegalSection>

      <LegalSection n={2} title="What you give us">
        <p>An account is the only thing that creates a record about you here.</p>
        <LegalList
          items={[
            <>
              <strong>Your email address and password.</strong> The password is
              handled by our authentication provider and stored only as a hash —
              it is never visible to us, and we cannot recover it, only reset it.
            </>,
            <>
              <strong>Your display name</strong>, if you set one. It is shown
              beside anything you post.
            </>,
            <>
              <strong>Two optional goals</strong> — a specialty and a hospital
              you are aiming at — chosen from a list rather than typed.
            </>,
            <>
              <strong>An optional profile photo.</strong> See section 04.
            </>,
            <>
              <strong>Anything you write</strong> — forum threads, replies, chat
              messages, hospital reviews, and reports you file.
            </>,
            <>
              <strong>Verification details</strong>, if you ask to be linked to a
              candidate record: your applicant id and the induction cycle.
            </>,
          ]}
        />
        <p>
          We do not ask for your CNIC, your phone number or your father’s
          name. Where those exist in a candidate record we ingested, they are
          visible to <strong>you and to staff, and to nobody else</strong> —
          enforced by the database itself, not by which page you happen to be on.
        </p>
      </LegalSection>

      <LegalSection n={3} title="Proving who you are">
        <p>
          Linking your account to a candidate record is the one place identity
          matters, and the rule is narrow on purpose: a link is confirmed by{" "}
          <strong>delivery</strong>. A single-use, expiring link is sent to the
          email address already on that candidate record. You cannot choose the
          destination address.
        </p>
        <p>
          An email address and an applicant id both appear in the induction
          material, so neither one proves anything by itself. Reaching an inbox
          that was already on the record does. For the same reason, we never put
          a password, PIN or code in the body of an email.
        </p>
      </LegalSection>

      <LegalSection n={4} title="Your profile photo">
        <p>
          A photo is optional and is stored in a <strong>private</strong>{" "}
          bucket. It has no permanent public address: another verified candidate
          sees it through a link we generate for them that expires within the
          hour.
        </p>
        <p>
          Before it is uploaded, your browser re-encodes the image. That is
          mostly a privacy measure rather than a size one — a photo taken on a
          phone usually carries the time it was taken and the GPS coordinates it
          was taken at. Re-encoding discards all of it, so we never receive your
          location as a side effect of you picking a picture.
        </p>
        <p>
          Your photo, display name and two goals are shown to other verified
          candidates <strong>only if you turn on discoverability</strong>. That
          setting is off unless you turn it on, and nothing else about you —
          your marks, your preferences, your applicant id, your email — is part
          of it.
        </p>
      </LegalSection>

      <LegalSection n={5} title="What never leaves your browser">
        <p>
          Several features work entirely on your own device. The following are
          stored in your browser’s local storage and are{" "}
          <strong>never sent to us</strong>:
        </p>
        <LegalList
          items={[
            "Your theme preference.",
            "Your shortlist of hospitals.",
            "The applicant id you enter to highlight yourself in a table.",
            "A candidate you add manually to try a simulation.",
            "Consent what-if scenarios you have run.",
            "Which announcements you have dismissed, and your date-format choice.",
          ]}
        />
        <p>
          This is a decision rather than a shortcut. A server-side record of
          which hospitals a named candidate is circling, or of who has been
          asking “what if” about whom during a live round, is not
          something this site needs to hold. Clearing your browser data clears
          all of it.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Cookies">
        <p>
          There are no advertising cookies, no analytics cookies and no
          third-party trackers on this site. There is no Google Analytics, no
          advertising pixel and no session-recording tool — none of those are
          part of this application at all.
        </p>
        <p>The cookies that do exist are these:</p>
        <LegalList
          items={[
            <>
              <strong>Session cookies</strong> from our authentication provider.
              These are what keep you signed in. Without them the site cannot
              tell one signed-in person from another.
            </>,
            <>
              <strong>One preference cookie</strong> recording which candidate
              status scope you have chosen in the portal’s Config tab, so
              that the pages you load answer the question you set.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection n={7} title="Who can see what">
        <p>
          Access is enforced in the database with row-level security, underneath
          every page and every request — not by hiding a button. Concretely:
        </p>
        <LegalList
          items={[
            <>
              <strong>Anyone signed out</strong> sees the public pages and
              nothing else.
            </>,
            <>
              <strong>A verified signed-in user</strong> sees the published merit
              records, the seat matrix, the applicant roster, and public
              community content.
            </>,
            <>
              <strong>You</strong> additionally see your own contact details,
              your own full preference list, and your own hidden posts.
            </>,
            <>
              <strong>Staff</strong> — a small number of moderator and
              administrator accounts — can see reported content and candidate
              records in order to answer verification and moderation questions.
            </>,
          ]}
        />
        <p>
          There is no bulk export. Search, filtering and paging all run in the
          database, so no single request returns the whole roster.
        </p>
      </LegalSection>

      <LegalSection n={8} title="Things you write">
        <p>
          Posts, replies, chat messages and reviews carry the display name you
          had when you wrote them. That name is a snapshot: renaming yourself
          later does not rewrite what other people already read.
        </p>
        <p>
          Content that is withdrawn or removed by staff is{" "}
          <strong>hidden, not deleted</strong>. It stays visible to its author,
          and it stays available for review. A moderation decision that destroys
          its own evidence cannot be checked, and a reported post that vanished
          would take the report with it.
        </p>
        <p>
          Reports are private. The person reported is not told who filed a report
          or that one exists.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Who else is involved">
        <p>
          We do not sell your data, and we do not share it with advertisers or
          data brokers. We are not part of an ad network.
        </p>
        <p>
          The site runs on infrastructure operated by other companies, which
          necessarily process data on our behalf: a database, authentication,
          file storage and transactional email provider, and a hosting provider.
          They act on our instructions and for no other purpose.
        </p>
        <p>
          We will disclose information where the law requires it. If that
          happens and we are permitted to tell you, we will.
        </p>
      </LegalSection>

      <LegalSection n={10} title="How long we keep things">
        <p>
          Account information is kept while your account exists. Published
          induction records are kept as long as the cycle is of historical
          interest — the point of the site is that you can compare against 2020.
        </p>
        <p>
          You can ask us to delete your account, your profile, your photo and
          your community posts, and we will. Published gazette entries are a
          different matter: they are a public record issued by the Punjab Health
          Foundation, and we are not the publisher of them. If you want an entry
          corrected at source, that is a request to PHF — but write to us anyway
          and we will look at our copy.
        </p>
      </LegalSection>

      <LegalSection n={11} title="Your choices">
        <LegalList
          items={[
            "Discoverability is off unless you turn it on, and can be turned off again at any time.",
            "A profile photo can be removed, and removing it deletes the stored file.",
            "You can ask for a copy of what we hold about you, or for it to be corrected or deleted.",
            "Clearing your browser data clears everything described in section 05.",
          ]}
        />
      </LegalSection>

      <LegalSection n={12} title="Changes, and how to reach us">
        <p>
          If this policy changes in a way that affects what we hold or who can
          see it, the date at the top changes and the change is announced on the
          site. We will not quietly widen what a setting means: a promise you
          agreed to under one wording will not be reinterpreted under another.
        </p>
        <p>
          For anything on this page — a correction, a deletion, a question about
          a record — write to{" "}
          <a
            href="mailto:itskaero@gmail.com"
            className="font-semibold text-brand-teal underline decoration-brand-teal/30 underline-offset-4 transition-colors hover:decoration-brand-teal"
          >
            itskaero@gmail.com
          </a>
          .
        </p>
        <p>
          See also the{" "}
          <Link
            href="/terms"
            className="font-semibold text-brand-teal underline decoration-brand-teal/30 underline-offset-4 transition-colors hover:decoration-brand-teal"
          >
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
