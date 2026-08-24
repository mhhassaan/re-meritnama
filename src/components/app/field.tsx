"use client";

import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from "react";
import { ChevronsDownIcon } from "@/components/icons/koboyo";

/**
 * Form controls, shared by the calculator and the merit filters.
 *
 * Native `<select>` and `<input>` render their own chrome — the OS arrow, the
 * number spinners — and that chrome is what makes an otherwise considered form
 * look unfinished, because it is the one part of the page that does not follow
 * the design system. Both are suppressed here and replaced.
 *
 * The controls stay native underneath. A custom listbox would mean rebuilding
 * keyboard interaction, type-ahead and the mobile picker, and would be worse at
 * all three than what the platform ships.
 */

const CONTROL_BASE =
  "w-full min-w-0 rounded-sm border bg-surface-sunken text-sm text-foreground " +
  "transition-[background-color,border-color,box-shadow] duration-[250ms] " +
  "ease-[cubic-bezier(0.32,0.72,0,1)] " +
  // Recessed: an input is a well you type into, not a raised surface.
  "shadow-[inset_0_1px_2px_var(--field-inset)] " +
  "hover:border-border-strong " +
  // Focus changes the border and adds a ring; it does NOT change the fill.
  // It used to lift from `surface-sunken` to `surface`, which on a select meant
  // the control flipped to the card's own background the instant it was
  // clicked — the click opens the popup and focuses at the same time, so the
  // change read as the control breaking. It also left the last-used select a
  // different colour from its neighbours for as long as focus stayed on it.
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring";

const CONTROL_HEIGHT = "min-h-[46px]";

export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="font-mono text-[10px] font-bold uppercase tracking-wider text-fg-muted"
    >
      {children}
    </label>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 font-mono text-[10px] leading-relaxed text-fg-subtle">
      {children}
    </p>
  );
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        // `appearance-none` removes the platform arrow; the right padding
        // reserves room for ours so a long option never runs under it.
        className={`${CONTROL_BASE} ${CONTROL_HEIGHT} appearance-none border-border-strong py-2.5 pl-3 pr-10 ${className}`}
      >
        {children}
      </select>

      <ChevronsDownIcon
        className="pointer-events-none absolute right-3 top-1/2 h-3 w-auto -translate-y-1/2 text-fg-subtle"
        aria-hidden
      />
    </div>
  );
}

/**
 * A number field.
 *
 * Numerics are monospace per the guidelines, and `tabular-nums` keeps the
 * digits from shifting as they are typed. The spinner arrows are removed: they
 * are a 12-pixel target that changes a merit component by one whole unit, and
 * nobody has ever wanted them.
 */
export function NumberField({
  className = "",
  suffix,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { suffix?: string }) {
  return (
    <div className="relative">
      <input
        {...props}
        type="number"
        inputMode="decimal"
        className={`${CONTROL_BASE} ${CONTROL_HEIGHT} border-border-strong px-3 py-2.5 font-mono tabular-nums placeholder:font-sans placeholder:text-fg-subtle [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield] ${
          suffix ? "pr-10" : ""
        } ${className}`}
      />

      {suffix && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-sm text-fg-subtle"
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

export function SearchField({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="search"
      className={`${CONTROL_BASE} ${CONTROL_HEIGHT} border-border-strong px-3 py-2.5 placeholder:text-fg-subtle ${className}`}
    />
  );
}

/**
 * A plain single-line text input.
 *
 * `SearchField` exists already but is `type="search"`, which browsers decorate
 * with a clear button and treat as a search box for autofill — wrong for a
 * display name.
 */
export function TextField({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      type="text"
      className={`${CONTROL_BASE} ${CONTROL_HEIGHT} border-border-strong px-3 py-2.5 placeholder:text-fg-subtle ${className}`}
    />
  );
}
