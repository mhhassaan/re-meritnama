import type { Metadata } from "next";
import Link from "next/link";
import { VerseStrip } from "@/components/app/verse-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { SUPPORTERS, SUPPORT_TOTALS } from "@/lib/support/supporters";
import { SupportersList } from "@/components/app/supporters-list";
import { PaymentTabs } from "@/components/app/payment-tabs";
import QRCode from "qrcode";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Support | MeritNama",
  description:
    "Why keeping this data online costs money, what it costs, and how to contribute.",
};

/**
 * Support.
 *
 * The original's `donate.html`, and its copy — the owner asked for it carried
 * across as it stands.
 *
 * **It is not a payment integration and never was.** There is no processor: the
 * page explains the hosting cost, gives bank and Raast details, and asks people
 * to claim a contribution through the access-request form, which this rebuild
 * already has — `access_requests` carries `payment_reference`,
 * `payment_declared` and `payment_verified`. So this is a content page plus one
 * link into a flow that exists.
 *
 * ## The totals and the supporters list are carried across
 *
 * Both are hardcoded, at the owner's instruction, from the live page on
 * 2026-08-25. There is no feed behind them and the page says so rather than
 * implying a number that updates itself.
 *
 * The names go through the same cleaning every other surface here applies —
 * parentage stripped, one email-as-a-name withheld. See
 * `@/lib/support/supporters` for the counts and the reasoning.
 */
/** The account, in the form a banking app expects to scan. */
const ACCOUNT_TITLE = "A** T****";
const ACCOUNT_NUMBER = "0891-2007-4774";
const BANK = "Mashreq Pakistan";
const REFERENCE = "MeritNama Support";

export default async function SupportPage() {
  // Generated on the server, once per render rather than per visitor's browser:
  // the value never changes, so shipping an encoder to the client would be
  // paying for work that can be done here. `margin: 1` keeps the quiet zone a
  // scanner needs without the default four-module frame.
  const qrSvg = await QRCode.toString(ACCOUNT_NUMBER.replace(/-/g, ""), {
    type: "svg",
    margin: 1,
    width: 190,
  });

  return (
    <div>
      <VerseStrip />

      <div className="mx-auto max-w-[900px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Community-funded · no ads</Eyebrow>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            Keep MeritNama{" "}
            <span className="text-accent">running</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Supporters keep live merit data, simulations and candidate tools
            online for every applicant in Pakistan.
          </p>
        </Reveal>

        <Bezel
          className="mt-12"
          innerClassName="grid grid-cols-1 gap-px bg-border sm:grid-cols-3"
        >
          <Cost
            value={`$${SUPPORT_TOTALS.raisedUsd.toFixed(2)}`}
            unit="total raised"
            note={`about PKR ${SUPPORT_TOTALS.raisedPkr.toLocaleString("en-GB")}`}
          />
          <Cost
            value={String(SUPPORT_TOTALS.supporters)}
            unit="supporters"
            note="people who have contributed"
          />
          <Cost
            value={`$${SUPPORT_TOTALS.perFetchUsd.toFixed(2)}`}
            unit="per data fetch"
            note="one full run of the pipeline"
          />
        </Bezel>

        {/* ── Why it costs anything ─────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-xl font-black tracking-[-0.02em] text-foreground">
            Why does this cost money now?
          </h2>

          <div className="mt-4 flex flex-col gap-4 text-[15px] leading-relaxed text-fg-muted">
            <p>
              Until recently, PRP merit list data was openly accessible — no
              barriers, no restrictions. That changed when the project gained
              traction among candidates who used it to hold committees
              accountable for seat manipulation and backroom allocations.
            </p>
            <p>
              In what many see as a deliberate move to limit public oversight,
              the endpoints were progressively rate-limited, CAPTCHAed and
              geo-blocked — making direct access impossible without
              infrastructure. Running this now requires rotating proxies and
              cloud machines just to fetch the same data that was completely free
              to read before.
            </p>
            <p className="font-bold text-foreground">
              This is not a technical problem. It is a political one.
            </p>
          </div>
        </section>

        {/* ── What it costs ─────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-fg-muted">
            What it costs
          </h2>

          <Bezel
            className="mt-3"
            innerClassName="grid grid-cols-1 gap-px bg-border sm:grid-cols-3"
          >
            <Cost value="$0.40" unit="per hour" note="cloud machine and proxy" />
            <Cost value="~6 hrs" unit="per full fetch" note="the whole applicant file" />
            <Cost value="~$2.40" unit="per run" note="about PKR 670" />
          </Bezel>

          <h3 className="mt-8 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-fg-muted">
            Suggested amounts
          </h3>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Suggestion label="One run" amount="$2.40" note="PKR 670" />
            <Suggestion label="Weekly" amount="$7" note="three full runs" />
            <Suggestion label="Monthly" amount="$29" note="twelve full runs" />
          </div>
        </section>

        {/* ── How to send it ────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-sans text-xl font-black tracking-[-0.02em] text-foreground">
            Make a transfer
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            Send any amount by bank transfer or Raast. Every contribution counts.
          </p>

          <PaymentTabs
            accountTitle={ACCOUNT_TITLE}
            accountNumber={ACCOUNT_NUMBER}
            bank={BANK}
            reference={REFERENCE}
            qrSvg={qrSvg}
          />
        </section>

        {/* ── How it works ──────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-fg-muted">
            How it works
          </h2>

          <ol className="mt-3 flex flex-col gap-3">
            <Step n={1} title="Transfer">
              Send any amount by bank transfer or Raast to the details above.
            </Step>
            <Step n={2} title="Tell us the reference">
              Submit your transaction reference through the{" "}
              <Link href="/auth" className="font-bold text-accent underline">
                access request form
              </Link>
              . It already has a field for it.
            </Step>
            <Step n={3} title="Get verified">
              An administrator checks the transfer against the reference and
              activates your supporter status.
            </Step>
          </ol>
        </section>

        {/* ── Supporters ────────────────────────────────────────────────── */}
        <section className="mt-12">
          <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-fg-muted">
            MeritNama supporters
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            <span className="font-mono font-bold text-foreground">
              ${SUPPORT_TOTALS.raisedUsd.toFixed(2)} USD
            </span>{" "}
            contributed by {SUPPORT_TOTALS.supporters} people, about PKR{" "}
            {SUPPORT_TOTALS.raisedPkr.toLocaleString("en-GB")}.
          </p>

          <SupportersList supporters={SUPPORTERS} />
        </section>

        <Bezel className="mt-8" innerClassName="flex items-start gap-3 p-5">
          <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
          <div className="min-w-0 text-sm leading-relaxed text-fg-muted">
            <p>
              <span className="font-bold text-status-reach">
                These figures are a snapshot, not a live total.
              </span>{" "}
              They were read from the original on 25 August 2026. Nothing here
              recounts them, so they will stay as they are until the file behind
              this page is updated.
            </p>
            <p className="mt-3">
              Names appear without a father’s name, which the original
              prints on 143 of the 185. This site strips parentage from the
              candidate roster, the joining export and the gazette names, and a
              page that also shows what somebody gave is not where to stop doing
              that. One supporter typed an email address into the name box and
              the original publishes it; that one shows here as{" "}
              <em>Anonymous supporter</em>, with the amount and date intact.
            </p>
          </div>
        </Bezel>

        <p className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          Contributions fund the infrastructure that fetches and hosts this data.
          They buy nothing on a merit list, change nobody’s position, and
          are not a condition of using anything here.
        </p>
      </div>
    </div>
  );
}

function Cost({
  value,
  unit,
  note,
}: {
  value: string;
  unit: string;
  note: string;
}) {
  return (
    <div className="bg-surface p-4">
      <p className="font-mono text-xl font-bold tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
        {unit}
      </p>
      <p className="mt-1 text-xs text-fg-muted">{note}</p>
    </div>
  );
}

function Suggestion({
  label,
  amount,
  note,
}: {
  label: string;
  amount: string;
  note: string;
}) {
  return (
    <Bezel innerClassName="p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-accent">
        {amount}
      </p>
      <p className="mt-0.5 text-xs text-fg-muted">{note}</p>
    </Bezel>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Bezel innerClassName="flex items-start gap-4 p-4">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-quiet font-mono text-xs font-bold text-accent"
        >
          {n}
        </span>
        <div className="min-w-0">
          <p className="font-sans text-sm font-bold text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-fg-muted">{children}</p>
        </div>
      </Bezel>
    </li>
  );
}
