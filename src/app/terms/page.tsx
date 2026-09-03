import type { Metadata } from "next";
import Link from "next/link";

import {
  LegalCallout,
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service | MeritNama",
  description:
    "What MeritNama is and is not, the rules for using it, and the limits of what its numbers can tell you.",
};

/**
 * The terms of service.
 *
 * The section that matters most is 01, and it is deliberately first and pulled
 * out of the numbering: this site is not the official source, and every figure
 * on it is derived from published records rather than issued. A candidate who
 * treats a predicted cutoff as a decision has misread the product, and the
 * terms are the wrong place to be coy about that.
 *
 * The rest is ordinary: who may hold an account, what may not be done with the
 * roster, how community content is moderated, and what a contribution is and is
 * not.
 */
export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="What this is, and how to use it"
      standfirst="MeritNama is an independent analytics tool built over published induction records. It is free to use, it is not the official source, and these are the rules that go with it."
      updated="30 August 2026"
    >
      <LegalCallout id="disclaimer" title="This is not the official source">
        <p>
          MeritNama is <strong>not affiliated with</strong> the Punjab Health
          Foundation, the Punjab Residency Programme, PMDC, CPSP, or any training
          hospital. Nothing here is issued by them, endorsed by them, or checked
          by them.
        </p>
        <p>
          Every number on this site is derived from records those bodies have
          published. Cutoffs, predictions, standings and seat allocations are{" "}
          <strong>estimates computed from past cycles</strong>, not statements
          about what will happen. The official merit list, the official schedule
          and the official policy are whatever PHF publishes, and where this site
          and PHF disagree, PHF is right.
        </p>
        <p>
          Check anything that affects a decision — a preference order, a consent,
          a joining date — against the official portal before you act on it.
        </p>
      </LegalCallout>

      <LegalSection n={1} title="Using the site">
        <p>
          You may use MeritNama to understand your own position in the induction
          process, to compare cycles, and to talk to other candidates. It is free
          and there is no paid tier.
        </p>
        <p>
          By using it you agree to these terms. If you do not, the remedy is
          simple: do not use it.
        </p>
      </LegalSection>

      <LegalSection n={2} title="Accounts and verification">
        <LegalList
          items={[
            "One account per person. Give a real email address you control — it is how we reach you and how a candidate link is confirmed.",
            "Keep your credentials to yourself. Anything done through your account is treated as done by you.",
            "Only ask to be linked to a candidate record that is genuinely yours. A link is confirmed by a single-use link delivered to the address already on that record, so attempting otherwise will not work — but attempting it is still a breach of these terms.",
            "We may suspend or remove an account that breaks these rules, and we will say why.",
          ]}
        />
      </LegalSection>

      <LegalSection n={3} title="What you may not do">
        <p>
          Most of this comes down to one idea: the people in these records did
          not choose to be here, and the site is designed so that no single
          request can hand anybody a copy of them.
        </p>
        <LegalList
          items={[
            <>
              <strong>No scraping or bulk collection.</strong> Do not use
              automated tools to harvest the roster, the merit lists, the
              community, or any other part of the site.
            </>,
            <>
              <strong>No republishing personal data.</strong> Do not copy names,
              applicant ids, marks or any other candidate detail out of this site
              into a public list, a spreadsheet, a channel or a group.
            </>,
            <>
              <strong>No circumventing access controls.</strong> Do not attempt
              to reach data you are not shown, to use somebody else’s
              account, or to probe the site for a way around its permissions.
            </>,
            <>
              <strong>No impersonation.</strong> Do not present yourself as
              another candidate, as staff, as PHF, or as this site.
            </>,
            <>
              <strong>No solicitation.</strong> Do not use anything you learn
              here to contact candidates for marketing, recruitment or any other
              approach they did not ask for.
            </>,
            <>
              <strong>No interference.</strong> Do not deliberately overload the
              site or interfere with anybody else’s use of it.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection n={4} title="Community content">
        <p>
          The forum, the feed, the chat rooms and the hospital reviews are
          written by other candidates. They are opinions, not facts, and they are
          not checked by us before they appear.
        </p>
        <LegalList
          items={[
            "Write under your own display name and stand behind what you say.",
            "No harassment, threats, or abuse.",
            "Do not post anybody else's personal details — a CNIC, a phone number, a home address, a photograph they did not share.",
            "A hospital review must be your own first-hand experience of training there.",
            "Do not present clinical advice as authoritative. This is a community of doctors, not a consultation.",
            "Do not post anything unlawful, or anything you do not have the right to post.",
          ]}
        />
        <p>
          Anyone can report a post. Nothing is hidden automatically on a report
          count — that is how a coordinated group silences a legitimate post — so
          a person looks at every report. Content that is removed is{" "}
          <strong>hidden rather than deleted</strong>, stays visible to its
          author, and can be reviewed. If you think a decision was wrong, write
          to us.
        </p>
      </LegalSection>

      <LegalSection n={5} title="What you post stays yours">
        <p>
          You keep ownership of everything you write. By posting it you give us
          permission to store it and to show it to the people the site is meant
          to show it to, for as long as it is on the site — nothing more. We do
          not license your posts to anybody else and we do not sell them.
        </p>
        <p>
          You are responsible for what you post, and you confirm you have the
          right to post it.
        </p>
      </LegalSection>

      <LegalSection n={6} title="Contributions">
        <p>
          MeritNama costs money to run — collecting each round’s data means
          hours of machine time against a portal that now blocks direct access.
          Contributions cover that.
        </p>
        <LegalList
          items={[
            "A contribution is voluntary. Nothing on this site is behind it, and choosing not to contribute changes nothing about what you can see.",
            "It is a contribution to running costs, not a purchase of a service, a subscription, or a promise that any feature will exist.",
            "Payments are made directly by bank transfer or Raast, so they are not processed by this site and cannot be reversed by it. If something has gone wrong with one, write to us.",
            "Supporters are listed publicly on the Support page. Tell us if you would rather be listed as anonymous.",
          ]}
        />
      </LegalSection>

      <LegalSection n={7} title="Accuracy, and its limits">
        <p>
          The data here is ingested from published sources, and those sources
          contain errors, duplicates, inconsistent spellings and mid-cycle
          revisions. Where we can correct something safely we do, and where a
          correction would misquote the source we leave it alone and say so on
          the page.
        </p>
        <p>
          Simulations are models. The seat allocation engine reproduces the
          published rounds closely but not exactly, because the real process
          includes grievance outcomes and manual corrections that no published
          input describes. A simulated placement is an indication of how
          contested a seat is. It is not an offer, and it is not a prediction of
          what PHF will do.
        </p>
      </LegalSection>

      <LegalSection n={8} title="No warranty, and liability">
        <p>
          The site is provided as it is, without any warranty. We do not promise
          that it will be available, that it will be free of errors, or that any
          figure on it is correct.
        </p>
        <p>
          To the extent the law allows, we are not liable for a decision you make
          on the basis of anything here — a preference order, a consent, a
          withdrawal, a joining. Those decisions are yours and their consequences
          run through the official process, not through this site.
        </p>
        <p>
          Nothing in these terms limits any liability that cannot lawfully be
          limited.
        </p>
      </LegalSection>

      <LegalSection n={9} title="Changing or ending the service">
        <p>
          Features may change and pages may be removed. If something that people
          rely on is going away, we will say so on the site before it does rather
          than after.
        </p>
        <p>
          You can stop using MeritNama at any time and ask us to delete your
          account. What happens to your data then is in the{" "}
          <Link
            href="/privacy"
            className="font-semibold text-brand-teal underline decoration-brand-teal/30 underline-offset-4 transition-colors hover:decoration-brand-teal"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection n={10} title="Governing law, and contact">
        <p>
          These terms are governed by the laws of Pakistan, and the courts of
          Pakistan have jurisdiction over any dispute arising from them.
        </p>
        <p>
          For anything here — a moderation decision, a takedown, a correction, a
          question — write to{" "}
          <a
            href="mailto:itskaero@gmail.com"
            className="font-semibold text-brand-teal underline decoration-brand-teal/30 underline-offset-4 transition-colors hover:decoration-brand-teal"
          >
            itskaero@gmail.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
