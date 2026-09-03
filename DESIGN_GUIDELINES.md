# MeritNama UI/UX & Aesthetics Design Guidelines

This document outlines the official design system, aesthetic principles, typography rules, color tokens, layout standards, and interaction guidelines established for **MeritNama**. All future app pages, components, dashboards, and features must strictly follow these guidelines to maintain a cohesive, high-craft, state-of-the-art user experience.

---

## 1. Visual Identity & Design Ethos

MeritNama balances **precision data engineering** (merit calculation, 13 gazette cycles, attempt deduction rules) with **empathetic clarity** for medical residency candidates in Punjab.

### Core Aesthetic Principles
1. **Warm Cream & Deep Teal Contrast**:
   - Primary Light Base: `#FAF9F5` (warm, inviting, paper-like cream base).
   - Primary Dark Base: `#0F2825` (midnight dark teal for heavy focus & telemetry sections).
   - Accent Teal: `#0D9488` (primary interactive teal) & `#115E59` / `#134E4A` (deep primary action buttons).
   - Warm Ivory Highlight: `#E8E0CA` (soft cream accent for badges, status labels, and secondary hero elements).
2. **Data Authenticity**:
   - All numbers (merit scores, seat capacities, rank deltas, gazette hashes) **MUST use monospace font styling** to convey precision.
3. **Physical Micro-Interactions**:
   - Interactive elements must respond to human touch with snappy, natural spring physics (`whileHover={{ y: -4, scale: 1.02 }}`, `whileTap={{ scale: 0.96 }}`).
4. **Squared Button Geometry**:
   - Action buttons use squared corners (`rounded-sm`) for a structured, professional control-room aesthetic. Avoid bubbly pill buttons for primary actions.
   - The exception is **icon-only** controls (dismiss, expand, trailing chevrons), which are circular. The rule is about labelled actions, not every round thing.
5. **Radius scale — the whole app uses three steps, and only three**:
   - `rounded-sm` — inputs, selects, action buttons. The default.
   - `rounded-md` — small inner containers, tags, telemetry pills.
   - `rounded-lg` — panel shells, grouped-control containers (the segmented
     toggle, the bezel outer tray), drawers and sheets.
   - `rounded-full` only for icon-only controls, dots and status pills.
   - **Nothing larger.** Marketing sections use `rounded-2xl`/`rounded-3xl` and
     stay there; app and admin surfaces do not. Large squircles read as a
     different product sitting next to the auth screens.
6. **Nested Enclosures ("double bezel")**:
   - Panels do not sit flat on the page. A recessed outer tray (`rounded-lg bg-surface-sunken/70 p-1 ring-1 ring-border`) holds an inner plate (`rounded-[0.25rem] bg-surface`) with a lit top edge (`shadow-[inset_0_1px_0_var(--edge-highlight)]`).
   - **The inner radius is the outer radius minus the shell padding.** Concentric curves only look right when they actually are; equal radii pinch the inner corner.
   - Use the `Bezel` component (`src/components/app/bezel.tsx`) rather than repeating the classes.
   - **`Bezel` is the marketing pages' construction and nothing else**: one surface, one hairline, no tray and no ambient shadow. The nested tray-and-plate enclosure was kept behind an `enclosed` prop for a while, nothing ever opted into it, and it has been deleted.
   - What made the enclosure read as heavy is **not** the hairline, which is 8%. It is that a card was built from four steps of value at once — tray, plate, lit edge and a 32px ambient shadow. Softening the border token would not have fixed that and would have washed out every divider on the site.
7. **Only what needs a box gets one, and a repeated grid never does.**
   - A page's own opening — eyebrow, headline, calls to action — carries no enclosure. A box around the top of a page draws a line between the page and itself.
   - A grid or stack of like items needs a *boundary*, not an *enclosure*. Use `HairlineGrid` / `HairlineCard` (`src/components/app/hairline-grid.tsx`), or its construction written out for a real `<ul>`: `gap-px bg-border` on the container, `bg-background` on every cell. Cells must be opaque or the container colour tints them, and hover is a **fill**, never a border — a border on hover puts the box straight back.
   - An enclosure is for content of a genuinely different class sitting beside other content, where without an edge it would read as part of its neighbour.
8. **Dropdowns are a real listbox, not a styled `<select>`.** `Select` (`src/components/app/select.tsx`) keeps a hidden native `<select>` for value, `onChange` and form submission, and draws its own trigger and options panel. The trigger was never the problem — the popup list is drawn by the operating system and ignores the design entirely.
9. **Text selection is tokenised** — `--selection-bg` / `--selection-fg`, per theme. The browser default is a hard blue belonging to no palette here, and selection is a colour the reader summons themselves. Not a reuse of `--accent-quiet`: that is a 10% wash meant to sit behind a badge and is too faint to read as a highlight.
10. **Depth is tokenised**: `--edge-highlight`, `--shadow-ambient`, `--shadow-lifted`. Never a hard `rgba(0,0,0,0.3)` drop shadow — ambient shadows are two layers, a tight contact shadow plus a wide diffused one. `lifted` is reserved for something that came forward in response to an action.

---

## 2. Color Palette & Token System

### Base Surface & Background Tokens

| Token Name | Hex Code | Tailwind Equivalent | Usage Context |
| :--- | :--- | :--- | :--- |
| `base-light` | `#FAF9F5` | `bg-[#FAF9F5]` | Default light page background |
| `surface-light` | `#FFFFFF` | `bg-white` | Light surface cards, floating badges, navbar |
| `base-dark` | `#0F2825` | `bg-[#0F2825]` | Ecosystem section, midnight dark containers |
| `surface-dark` | `#143733` | `bg-[#143733]/95` | Dark mode cards, glassmorphic feature containers |
| `pill-dark` | `#0B1E1C` | `bg-[#0B1E1C]` | Standardized telemetry footer pills in dark cards |

### Text & Typography Colors

| Token Name | Hex Code | Usage Context |
| :--- | :--- | :--- |
| `text-primary-light` | `#171717` / `#1A2118` | Primary headings and high-contrast text on light base |
| `text-muted-light` | `#737373` / `#78716C` | Subtitles, body copy, and secondary labels on light base |
| `text-primary-dark` | `#FFFFFF` | Headings on dark midnight base |
| `text-muted-dark` | `#D6D3D1` / `#A8A29E` | Secondary body text on dark midnight base |
| `text-accent-teal` | `#0D9488` / `#2DD4BF` | Section eyebrow labels, highlighted words, active status badges |
| `text-accent-cream` | `#E8E0CA` | Warm ivory badges and secondary icon highlights in dark sections |

### Status & Telemetry Indicators

- **Verified / Safe**: Mint Cyan (`#2DD4BF`) or Emerald (`#10B981`).
- **Calculated / Rules Engine**: Warm Ivory (`#E8E0CA`).
- **Live / Active Telemetry**: Mint Cyan (`#2DD4BF`).
- **Destructive / Alert**: Coral Red (`#EF4444`).

---

## 3. Typography & Font Rules

### Font Families
1. **Sans-Serif (Headings & Body)**: `font-sans` (System UI / Inter / Plus Jakarta Sans)
   - Used for all section titles, subtitles, card headers, body copy, and navigation links.
2. **Monospace (Data & Telemetry)**: `font-mono` (`ui-monospace`, `SFMono-Regular`, `JetBrains Mono`)
   - **MANDATORY FOR**: Merit scores, seat counts, rank numbers, gazette release hashes, tag badges, and timestamps.

### Heading Scale & Hierarchy

| Element | Size | Weight | Leading | Letter Spacing |
| :--- | :--- | :--- | :--- | :--- |
| **Hero Title** | `text-4xl sm:text-6xl lg:text-7xl` | `font-black (900)` | `leading-[1.05]` | `tracking-tight` |
| **Section Title** | `text-3xl sm:text-4xl lg:text-5xl` | `font-black (900)` | `leading-[1.1]` | `tracking-tight` |
| **Accordion / Card Title** | `text-2xl sm:text-3xl lg:text-4xl` | `font-extrabold (800)` | `leading-[1.1]` | `tracking-tight` |
| **Subtitle / Lead** | `text-base sm:text-lg` | `font-medium (500)` | `leading-relaxed` | Normal |
| **Eyebrow Label** | `text-[10px] sm:text-[11px]` | `font-bold (700)` | `leading-none` | `tracking-[0.38em]` uppercase |
| **Pill Tag / Badge** | `text-[10px] sm:text-xs` | `font-bold (700)` | `leading-none` | `tracking-[0.2em]` uppercase |

---

## 4. Layout & Grid Standards

### Motion

- **Curves**: `--ease-smooth-out` for small state changes; `--ease-weighted`
  (`cubic-bezier(0.32, 0.72, 0, 1)`) for anything that should feel like it has
  mass — panels opening, sheets rising, elements entering the viewport. Never
  `linear` or bare `ease-in-out`.
- **Entry**: `<Reveal>` (`src/components/app/reveal.tsx`) fades and lifts content
  in on `IntersectionObserver`, never a scroll listener. It honours
  `prefers-reduced-motion` and shows anything already on or above the screen
  immediately — an observer never fires for an element above the viewport, and
  content must not depend on an animation to become visible.
- **Never wrap a `position: fixed` overlay in `<Reveal>`.** It carries a
  `transform`, which makes it the containing block for fixed descendants; a
  bottom sheet inside will anchor to the wrapper, not the viewport.
- **Composited properties only**: animate `transform` and `opacity`. Never
  `height`, `top`, `width` or `filter`.
- **`backdrop-blur` only on fixed elements** (scrims, sticky chrome). On a
  scrolling container it repaints every frame and destroys mobile framerate.

### Page Container Widths
- **Max Width**: `max-w-7xl` (1280px) centered with `mx-auto`.
- **Horizontal Padding**: `px-4 sm:px-8 lg:px-10`.
- **Vertical Section Spacing**: `py-20 md:py-32`.

### Responsive Breakpoints
- **Mobile (`< 768px`)**: Single column layout, collapsed navigation, hidden background decorative illustrations.
- **Tablet (`768px - 1024px`)**: Dual-column grids (`md:grid-cols-2`), sticky headers.
- **Desktop (`>= 1024px`)**: Full multi-column grids (`lg:grid-cols-3`), side-by-side sticky accordion layouts, floating telemetry cards.

---

## 5. Component Construction Principles

### A. Buttons & Interactive CTAs

```tsx
/* Primary Action Button (Squared rounded-sm) */
<Link
  href="/app.html"
  style={{ backgroundColor: "#115E59", color: "#FFFFFF" }}
  className="group flex min-h-[40px] items-center gap-2 rounded-sm px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_2px_10px_rgba(0,0,0,0.1)] transition-all duration-150 ease-out hover:bg-[#134E4A] active:scale-[0.96]"
>
  <span>Launch App</span>
  <ArrowRight className="h-4 w-4 text-white transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
</Link>
```

- **Geometry**: Always use `rounded-sm` (squared corners), never `rounded-full` for primary actions.
- **Feedback**: Include `active:scale-[0.96]` for tactile click feel and icon translation (`group-hover:translate-x-0.5`).

### B. Accordions & Process Steppers

- **Header State**: Inactive titles use `#737373` (stone muted); active expanded titles transition to `#171717` (primary black).
- **Body Layout**: Flexbox row (`flex gap-8 items-start pt-2 sm:pt-4 pb-10`).
- **Illustrations**: Positioned on the right side of the expanded body (`w-[260px] lg:w-[320px] p-2 self-center`), hidden on mobile (`hidden md:flex`).

### C. Dark Feature Cards (Ecosystem Grid)

```tsx
<motion.div
  whileHover={{ y: -6, scale: 1.02 }}
  transition={{ type: "spring", stiffness: 220, damping: 20 }}
  className="w-[340px] sm:w-[390px] h-[340px] shrink-0 rounded-3xl bg-[#143733]/95 border border-transparent p-7 flex flex-col justify-between relative overflow-hidden group shadow-xl select-none"
>
  {/* Top Row with Icon Badge */}
  <div className="flex items-center justify-between gap-4 mb-5">
    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-teal-900/80 border border-teal-600/60 flex items-center justify-center shrink-0 text-[#E8E0CA]">
      <IconComponent className="h-7 w-auto text-[#E8E0CA] sm:h-8" />
    </div>
    <ArrowUpRight className="w-5 h-5 text-stone-400 group-hover:text-[#E8E0CA] transition-colors shrink-0" />
  </div>

  {/* Title & Body */}
  <div>
    <h3 className="font-sans text-xl sm:text-2xl font-extrabold text-white tracking-tight mb-2 min-h-[52px] flex items-center leading-snug">
      {card.title}
    </h3>
    <p className="font-sans text-xs text-stone-300 font-medium leading-relaxed">
      {card.description}
    </p>
  </div>

  {/* Standardized Bottom Telemetry Footer Pill */}
  <div className="w-full bg-[#0B1E1C] rounded-md border border-teal-900/80 p-3 px-3.5 font-mono text-xs text-stone-300 flex items-center justify-between shadow-inner mt-3">
    <span className="flex items-center gap-2 font-bold text-stone-300 text-[11px]">
      <TelemetryIcon className="w-3.5 h-3.5 text-[#E8E0CA] shrink-0" />
      {card.telemetryLabel}
    </span>
    <span className="text-[11px] font-bold text-[#2DD4BF]">
      {card.statusBadge}
    </span>
  </div>
</motion.div>
```

- **Card Border**: Set to `border-transparent` for clean container floating without harsh outlines.
- **Pill Radius**: Bottom telemetry pills MUST use `rounded-md` corners to match site-wide tag geometry.

---

## 6. Motion & Micro-Interaction Guidelines

### Framer Motion Spring Presets

```ts
// Smooth Nav & Header Fade
export const NAV_SPRING = { type: "spring", damping: 20, stiffness: 160 };

// Card Hover Lift
export const CARD_HOVER_SPRING = { type: "spring", stiffness: 220, damping: 20 };

// Accordion Expand Smoothness
export const ACCORDION_EASE = [0.22, 1, 0.36, 1] as const;
```

### GSAP ScrollTrigger Rules
1. **Parallax Background**: Hero vector illustrations scrub at `scrub: 0.6` with `yPercent: 12`.
2. **Floating Tickers**: Ambient floating cards bob continuously with `y: -10`, `yoyo: true`, `duration: 2.8s`, `ease: "sine.inOut"`.
3. **Section Reveals**: Below-the-fold content uses `.gsap-reveal` staggered fade-ups (`y: 20 -> 0`, `duration: 0.5s`, `ease: "power3.out"`).

---

## 7. Graphics & Iconography Guidelines

1. **Koboyo Hand-Drawn SVG Icons**:
   - Use custom Koboyo SVG components from `@/components/koboyo-icons` (`KoboyoStethoscope`, `KoboyoCalculator`, `KoboyoChartNetwork`, `KoboyoChart`, `KoboyoHospital`, `KoboyoBriefcaseMedical`, `KoboyoApprovedDocument`).
   - Color styling: `#E8E0CA` (warm ivory) or `#0D9488` (teal).
2. **Vector Illustrations**:
   - Stored in `public/illustrations/` (`person verified.svg`, `user rank one.svg`, `man hospital.svg`).
   - Standard render bounds: `width={320} height={320}`, `opacity-95`, `drop-shadow-md`.
3. **Hero Widescreen Artwork**:
   - Vector landscape artwork in `public/data/hero_illust.png` rendered with a gradient left mask (`from-[#FAF9F5] via-[#FAF9F5]/90 to-transparent`) for 100% text legibility.

---

## 8. Checklist for Building New Pages

Before shipping any new page in `src/app/`:

- [ ] Does the page use `#FAF9F5` as its base light background (or `#0F2825` for dark analytical views)?
- [ ] Are primary action buttons using squared corners (`rounded-sm`) with `bg-[#115E59]`?
- [ ] Are all numbers, merit scores, percentiles, and counts styled with `font-mono`?
- [ ] Do interactive cards include spring hover lifts (`whileHover={{ y: -6 }}`)?
- [ ] Are bottom telemetry pills using `rounded-md` geometry with `text-[#2DD4BF]` right-aligned status text?
- [ ] Does the layout adapt gracefully from mobile (`px-4`) to widescreen desktop (`max-w-7xl px-10`)?
- [ ] Does the code compile cleanly with `npm run build` with zero TypeScript errors?

## Icons on controls

**Every clickable or actionable control gets an animated icon.** Primary and
secondary buttons, submits, "load more", toolbar actions, navigation rows —
all `@hugeicons-animated`, wired through `useActionIcon()` in
`src/components/app/action-icon.ts` so the control owns the hover rather than
the 16 pixels of artwork inside it.

Static Koboyo icons remain correct for anything that is **not** pressable:

- an illustration in an empty state,
- a marker beside a heading or a specialty label,
- an inline status or warning glyph beside prose.

Sizes are `ICON_SIZE` (18) in the navigation rails and `ICON_SIZE_SM` (16)
beside a button label. Both come from the same module; do not restate them.

Three constraints follow from how the components are built, and all three have
already caused a bug here:

1. They render a **`<div>`**. Never place one inside a `<span>` or a `<p>` —
   invalid HTML, and it fails hydration.
2. They need a `ref` to be driven by their parent. Without it the animation
   fires only when the pointer crosses the icon itself.
3. Wire `onFocus`/`onBlur` alongside hover, or keyboard users get no cue at all.
   `useActionIcon` does all three; use it rather than hand-rolling the handlers.

`prefers-reduced-motion` is handled inside `src/lib/use-icon-animation.ts`, so
no call site guards it.
