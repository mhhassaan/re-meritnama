"use client";

import { useId, useState } from "react";
import { CopyValue } from "@/components/app/copy-value";
import { CreditCardIcon } from "@/components/ui/credit-card";
import { QrCode01Icon } from "@/components/ui/qr-code-01";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * Bank transfer and Raast, as two tabs — the original's arrangement.
 *
 * They are genuinely two ways of doing the same thing rather than two halves of
 * one instruction: somebody paying from a banking app scans the code and never
 * reads the account number, and somebody typing a transfer never looks at the
 * code. Showing both at once makes each reader skip half the panel to find
 * their half.
 *
 * Icons are `@hugeicons-animated`, not Koboyo. A tab is a control, and the
 * standing rule is that anything clickable animates — Koboyo stays for
 * labelling. The `ref` is what switches these to parent control, so the motion
 * plays when the pointer crosses the whole tab rather than the 16 pixels of
 * artwork inside it.
 *
 * The QR is rendered server-side into the `qrSvg` prop. There is no client
 * library and no CDN: the value never changes, so generating it per visit in
 * the browser would ship an encoder to do work that can be done once.
 */

type Tab = "bank" | "raast";

export function PaymentTabs({
  accountTitle,
  accountNumber,
  bank,
  reference,
  qrSvg,
}: {
  accountTitle: string;
  accountNumber: string;
  bank: string;
  reference: string;
  /** A complete `<svg>` string for the Raast number. */
  qrSvg: string;
}) {
  const [tab, setTab] = useState<Tab>("bank");
  const base = useId();

  const bankIcon = useActionIcon();
  const raastIcon = useActionIcon();

  const tabClass = (id: Tab) =>
    `flex min-h-[44px] flex-1 items-center justify-center gap-2.5 rounded-sm border px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors ${
      tab === id
        ? "border-accent bg-accent-quiet text-accent"
        : "border-border-strong text-fg-muted hover:border-accent hover:text-foreground"
    }`;

  return (
    <div className="mt-4">
      {/* `role="tablist"` with arrow-key movement is what makes this a tab set
          rather than two buttons that happen to look like one. */}
      <div role="tablist" aria-label="How to pay" className="flex gap-2">
        <button
          type="button"
          role="tab"
          id={`${base}-tab-bank`}
          aria-selected={tab === "bank"}
          aria-controls={`${base}-panel-bank`}
          onClick={() => setTab("bank")}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") setTab("raast");
          }}
          {...bankIcon.handlers}
          className={tabClass("bank")}
        >
          <CreditCardIcon ref={bankIcon.ref} size={ICON_SIZE_SM} aria-hidden />
          Bank transfer
        </button>

        <button
          type="button"
          role="tab"
          id={`${base}-tab-raast`}
          aria-selected={tab === "raast"}
          aria-controls={`${base}-panel-raast`}
          onClick={() => setTab("raast")}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") setTab("bank");
          }}
          {...raastIcon.handlers}
          className={tabClass("raast")}
        >
          <QrCode01Icon ref={raastIcon.ref} size={ICON_SIZE_SM} aria-hidden />
          Raast / QR
        </button>
      </div>

      {tab === "bank" ? (
        <div
          role="tabpanel"
          id={`${base}-panel-bank`}
          aria-labelledby={`${base}-tab-bank`}
          className="mt-3 rounded-md border border-border bg-surface"
        >
          <Row label="Account title" value={accountTitle} />
          <Row label="Account number" value={accountNumber} copyable />
          <Row label="Bank" value={bank} />
          <Row label="Reference (optional)" value={reference} copyable />
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`${base}-panel-raast`}
          aria-labelledby={`${base}-tab-raast`}
          className="mt-3 rounded-md border border-border bg-surface p-6 text-center"
        >
          <p className="font-sans text-sm font-bold text-foreground">
            Scan with any Pakistani banking app
          </p>

          {/* White ground, always. A QR is read by contrast, and the dark theme
              would otherwise put dark modules on a dark card — scannable by
              nothing. The border keeps it from floating on a dark page. */}
          <div
            className="mx-auto mt-4 w-fit rounded-sm border border-border-strong bg-white p-3"
            aria-hidden
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />

          <div className="mt-5 flex flex-col items-center gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted">
              Raast ID
            </p>
            <CopyValue value={accountNumber} />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-fg-subtle">
            Account holder: {accountTitle} · {bank}
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  copyable = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 last:border-b-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-muted">
        {label}
      </p>
      {copyable ? (
        <CopyValue value={value} />
      ) : (
        <p className="break-words font-mono text-sm font-bold text-foreground">
          {value}
        </p>
      )}
    </div>
  );
}
