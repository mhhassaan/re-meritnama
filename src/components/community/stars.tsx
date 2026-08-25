"use client";

/**
 * Star ratings, read-only and editable.
 *
 * The original draws these as ★ characters, and so do these — a glyph scales
 * with the type, needs no asset, and is the one place in this project where an
 * emoji-adjacent character is the honest primitive rather than decoration.
 *
 * The editable one is a **radio group**, not five buttons. Five buttons give a
 * keyboard user five tab stops and no sense that they are one choice; a radio
 * group is one tab stop with arrow keys, which is what the control actually is.
 * The visible stars are the labels.
 */

const STARS = [1, 2, 3, 4, 5];

export function StarsRead({
  value,
  className = "",
  size = "text-sm",
}: {
  value: number | null;
  className?: string;
  size?: string;
}) {
  if (value == null) {
    return (
      <span className={`font-mono text-[10px] text-fg-subtle ${className}`}>
        not rated
      </span>
    );
  }

  const rounded = Math.round(value);

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span aria-hidden className={`${size} leading-none tracking-[0.08em]`}>
        {STARS.map((n) => (
          <span
            key={n}
            className={n <= rounded ? "text-status-reach" : "text-border-strong"}
          >
            ★
          </span>
        ))}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-fg-muted">
        {value.toFixed(1)}
      </span>
      <span className="sr-only">{value.toFixed(1)} out of 5</span>
    </span>
  );
}

export function StarsInput({
  name,
  label,
  value,
  onChange,
  optional = false,
}: {
  name: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  optional?: boolean;
}) {
  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <legend className="sr-only">{label}</legend>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
        {label}
        {optional && <span className="ml-1.5 text-fg-subtle">optional</span>}
      </span>

      <span className="flex items-center gap-0.5">
        {STARS.map((n) => (
          <label
            key={n}
            className="cursor-pointer p-0.5 leading-none"
            title={`${n} of 5`}
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={`text-lg leading-none transition-colors ${
                n <= value
                  ? "text-status-reach"
                  : "text-border-strong hover:text-status-reach/60"
              }`}
            >
              ★
            </span>
            <span className="sr-only">{n} of 5</span>
          </label>
        ))}

        {/* The clear control gets a reserved slot on every row, whether or not
            it is showing. Appended only when something was rated, it widened
            this group and shoved the stars leftward the instant a star was
            picked — and because the rows sit in one column, an unreserved row
            would also line its stars up differently from a reserved one. Fixed
            width, always present, empty when there is nothing to clear. */}
        <span className="ml-2 w-9 shrink-0 text-right">
          {optional && value > 0 && (
            <button
              type="button"
              onClick={() => onChange(0)}
              className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle transition-colors hover:text-status-reach"
            >
              clear
            </button>
          )}
        </span>
      </span>
    </fieldset>
  );
}
