"use client";

import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronsDownIcon } from "@/components/icons/koboyo";

/**
 * The dropdown.
 *
 * ## Why this is not a native `<select>` any more
 *
 * It used to be, with `appearance-none` and our own chevron, and the reasoning
 * written here was that a custom listbox would be worse than the platform's at
 * keyboard interaction, type-ahead and the mobile picker. Half of that still
 * holds — which is why all three are implemented below rather than skipped.
 *
 * What it missed is that the closed control was never the problem. **The popup
 * list is drawn by the operating system**, so it is the one surface in the
 * product that ignores the design entirely: system font, system radius, system
 * highlight, and on Windows a hard blue selection bar in the middle of a teal
 * page. Styling the trigger and leaving that alone is fixing the half nobody
 * looks at.
 *
 * ## The native element is still here
 *
 * A real `<select>` is rendered, hidden, carrying the same `value`, `onChange`,
 * `name` and `disabled`. Choosing an option sets its value through the native
 * setter and dispatches a real `change` event, so React delivers the call
 * site's own `onChange` a genuine `ChangeEvent<HTMLSelectElement>`. That is why
 * none of the 69 call sites changed: the public API is the same element it
 * always was, and form submission by `name` still works.
 *
 * Setting `.value` directly would not do it — React tracks the last value it
 * wrote on the DOM node and swallows the event as a no-op, so the setter has to
 * be reached through the prototype descriptor to clear that tracker.
 *
 * ## What had to be rebuilt, and is
 *
 * - Arrow keys, Home/End, Enter/Space, Escape, and Tab-to-close.
 * - **Type-ahead**, which matters more here than anywhere: the specialty filter
 *   has 44 options and the hospital filter 69, and typing "card" is how anybody
 *   actually uses those.
 * - The active option is tracked with `aria-activedescendant` against
 *   `role="listbox"`, so focus never leaves the trigger and a screen reader
 *   reads the highlighted row.
 * - The panel flips above the trigger when there is not room below, which the
 *   filters at the foot of a long page need.
 */

type OptionItem = {
  value: string;
  label: string;
  disabled: boolean;
};

/** Read the `<option>` children the call site wrote, in order. */
function readOptions(children: ReactNode): OptionItem[] {
  const out: OptionItem[] = [];

  const walk = (nodes: ReactNode) => {
    Children.forEach(nodes, (child) => {
      if (!isValidElement(child)) return;

      // Mapped arrays are flattened by `Children.forEach`, but an explicit
      // `<>...</>` wrapper is still one element holding its own children.
      if ((child.type as unknown) === Fragment) {
        walk((child.props as { children?: ReactNode }).children);
        return;
      }

      if (child.type === "option") {
        const props = child.props as {
          value?: string | number;
          children?: ReactNode;
          disabled?: boolean;
        };
        const label =
          typeof props.children === "string"
            ? props.children
            : String(props.children ?? "");
        out.push({
          value: String(props.value ?? label),
          label,
          disabled: Boolean(props.disabled),
        });
      }
    });
  };

  walk(children);
  return out;
}

export function Select({
  className = "",
  children,
  value,
  onChange,
  disabled,
  id,
  "aria-label": ariaLabel,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = useMemo(() => readOptions(children), [children]);
  const nativeRef = useRef<HTMLSelectElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const listId = useId();
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [active, setActive] = useState(0);

  const current = String(value ?? "");
  const selectedIndex = options.findIndex((o) => o.value === current);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  /**
   * Commit a choice through the hidden native element so the call site's
   * `onChange` receives a real event. React's value tracker has to be bypassed
   * with the prototype setter or the event never fires.
   */
  const commit = useCallback((next: string) => {
    const el = nativeRef.current;
    if (!el) return;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value"
    )?.set;
    setter?.call(el, next);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, []);

  const close = useCallback(
    (refocus = true) => {
      setOpen(false);
      if (refocus) triggerRef.current?.focus();
    },
    []
  );

  const choose = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      if (option.value !== current) commit(option.value);
      close();
    },
    [options, current, commit, close]
  );

  // Open on the selected row, not the top: a list of 69 hospitals that always
  // opens at "All" makes the current choice look unset.
  useEffect(() => {
    if (open) setActive(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  // Decide direction before paint, or the panel appears below and jumps up.
  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const wanted = Math.min(options.length * 38 + 8, 288);
    setDropUp(
      rect.bottom + wanted > window.innerHeight && rect.top > wanted + 8
    );
  }, [open, options.length]);

  // Keep the active row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;

    // `pointerdown`, not `click` — a click listener fires after the trigger's
    // own handler has reopened the panel, so it would never shut.
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Type-ahead. The buffer clears after a second of no typing, the way a native
  // select behaves, so "ca" then later "r" is two searches and not "car".
  const typed = useRef("");
  const typedAt = useRef(0);

  const typeAhead = useCallback(
    (char: string) => {
      const now = Date.now();
      typed.current = now - typedAt.current > 1000 ? char : typed.current + char;
      typedAt.current = now;

      const needle = typed.current.toLowerCase();
      const from = open ? active : selectedIndex;
      const order = [
        ...options.slice(from + 1),
        ...options.slice(0, from + 1),
      ];
      const hit = order.find(
        (o) => !o.disabled && o.label.toLowerCase().startsWith(needle)
      );
      if (!hit) return;

      const index = options.indexOf(hit);
      if (open) setActive(index);
      else commit(hit.value);
    },
    [open, active, selectedIndex, options, commit]
  );

  const move = useCallback(
    (delta: number) => {
      const usable = options.filter((o) => !o.disabled);
      if (usable.length === 0) return;
      let next = active;
      for (let i = 0; i < options.length; i++) {
        next = Math.min(options.length - 1, Math.max(0, next + delta));
        if (!options[next].disabled) break;
        if (next === 0 || next === options.length - 1) break;
      }
      setActive(next);
    },
    [active, options]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        typeAhead(e.key);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        // Not prevented: Tab should still move on, it just closes first.
        setOpen(false);
        break;
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          typeAhead(e.key);
        }
    }
  };

  return (
    <div ref={rootRef} className="relative">
      {/* Order matters: the button comes first because several call sites wrap
          the control in a `<label>` rather than using `htmlFor`, and an implicit
          label activates the *first* labelable descendant. With the hidden
          select first, clicking the label focused something invisible and the
          dropdown never opened. A `<button>` is labelable, so putting it first
          restores the click. Its accessible name still comes from the label
          text, and the hidden select's option text is excluded from that
          because the select is `aria-hidden`. */}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        className={`flex min-h-[46px] w-full min-w-0 items-center justify-between gap-2 rounded-sm border border-border-strong bg-surface-sunken py-2.5 pl-3 pr-3 text-left text-sm text-foreground shadow-[inset_0_1px_2px_var(--field-inset)] transition-[background-color,border-color,box-shadow] duration-[250ms] ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? "border-accent ring-2 ring-ring" : ""
        } ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">
          {selected?.label ?? ""}
        </span>
        <ChevronsDownIcon
          aria-hidden
          className={`h-3 w-auto shrink-0 text-fg-subtle transition-transform duration-[200ms] ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* The real control. Hidden from sight and from assistive technology —
          the button below carries the semantics — but still the thing that
          holds the value, fires `onChange`, and submits with a form. */}
      <select
        {...props}
        ref={nativeRef}
        // The visible trigger takes the `id`, so a `<label htmlFor>` focuses
        // the thing you can actually operate. This one still needs an
        // identifier of its own: a form field with neither `id` nor `name` is
        // flagged by the browser and is invisible to autofill.
        id={`${listId}-native`}
        value={value}
        onChange={onChange}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute h-0 w-0 opacity-0"
      >
        {children}
      </select>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute left-0 right-0 z-50 max-h-72 overflow-y-auto rounded-sm border border-border-strong bg-surface p-1 shadow-lifted ${
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {options.map((option, i) => {
            const isSelected = option.value === current;
            const isActive = i === active;

            return (
              <li
                key={`${option.value}-${i}`}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                // `pointerdown`, not `click`: the outside-close listener also
                // runs on pointerdown, and on a click the panel would be gone
                // before the click landed.
                onPointerDown={(e) => {
                  e.preventDefault();
                  choose(i);
                }}
                onMouseEnter={() => !option.disabled && setActive(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-[0.2rem] px-2.5 py-2 text-sm transition-colors ${
                  option.disabled
                    ? "cursor-not-allowed text-fg-subtle opacity-60"
                    : isActive
                      ? "bg-accent-quiet text-foreground"
                      : "text-fg-muted"
                } ${isSelected ? "font-bold text-accent" : ""}`}
              >
                {/* A fixed slot, so the label of a selected row sits at the
                    same x as every other one — a tick that appears inline
                    would shove the text sideways. */}
                <span
                  aria-hidden
                  className={`w-3 shrink-0 text-center font-mono text-[11px] ${
                    isSelected ? "text-accent" : "text-transparent"
                  }`}
                >
                  •
                </span>
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
