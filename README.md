# MeritNama — Next.js 16 Platform Redesign

A state-of-the-art, high-performance web platform for medical residency induction intelligence, gazette verification, cascade simulation, and candidate auth access. Built with Next.js 16 (App Router), Tailwind CSS, Framer Motion, and Lucide React.

---

## 🌟 Highlights of the Redesign

- **Control-Room Design System**: Warm cream base (`#FAF9F5`), deep midnight teal controls (`#0F2825`, `#115E59`), mint status highlights (`#2DD4BF`), and warm ivory accents (`#E8E0CA`).
- **Interactive Landing Portal**:
  - **Hero Section**: Dynamic typography, ambient glowing lighting, bouncing white squared scroll prompt.
  - **Pinned Horizontal Ecosystem**: 220vh sticky scroll runway with smooth looping cards, contextual Koboyo icons, and monospace data pills.
  - **How It Works Interactive Accordion**: High-resolution non-clipped SVG illustrations (`person verified.svg`, `user rank one.svg`, `man hospital.svg`).
  - **Trust & Verification Metrics**: Real-time gazette candidate verification count & cryptographic hash tracking.
  - **Final CTA**: High-converting access unlock card.
- **Candidate Auth Portal (Watermelon `auth-10` Inspired)**:
  - Multi-layered pure gradient mesh left panel with prominent centered MeritNama brand logo.
  - Right panel featuring sliding `layoutId` spring active tab pill (**Sign In**, **Request Access**, **Submit Payment**).
  - SHA-256 applicant ID client PIN hashing & gazette record candidate lookup.
  - In-place spring entrance animations (`staggerChildren: 0.04`, `stiffness: 350`, `damping: 25`).
  - Tactile button press feedback (`whileTap={{ scale: 0.97 }}`).

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 16.2](https://nextjs.org/) (App Router & Turbopack)
- **UI & Styling**: Vanilla CSS + Tailwind CSS v3
- **Animations**: [Framer Motion](https://www.framer.com/motion/) (Spring physics, `layoutId`, `AnimatePresence`)
- **Icons**: [Lucide React](https://lucide.dev/) + Custom Medical Koboyo Icons
- **Fonts**: Geist Sans & Geist Mono (`font-mono` enforced for numerical data)

---

## 🚀 Getting Started

First, install dependencies and run the local development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to explore the redesign.

### Key Routes

| Route | Description |
| --- | --- |
| `/` | Landing page featuring Hero, Ecosystem Runway, How It Works, Trust Metrics, and CTA |
| `/login` | Candidate Sign In / Access Request / Payment Proof Submission Portal |
| `/signup` | Direct route to Candidate Access Request |
| `/auth` | Unified Candidate Portal View |

---

## 🎨 Design System & Guidelines

All components strictly follow the guidelines defined in [`DESIGN_GUIDELINES.md`](./DESIGN_GUIDELINES.md) and [`.agents/skills/ui-design/SKILL.md`](./.agents/skills/ui-design/SKILL.md).
