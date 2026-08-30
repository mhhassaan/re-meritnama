"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

// ─── Data ─────────────────────────────────────────────────────────────────────
const STEPS = [
  {
    title: "Calculate your merit",
    eyebrow: "OFFICIAL PHF FORMULA",
    body: "Enter your MBBS/BDS marks, experience points, and publications. The calculator applies official PHF attempt deductions automatically — no guesswork, no manual formula lookups.",
    cta: { href: "/app/calculator", label: "Open Calculator" },
    illustration: "/illustrations/person verified.svg",
  },
  {
    title: "See where you stand",
    eyebrow: "13 GAZETTE CYCLES",
    body: "Compare your score against historical closing cutoffs from 13 gazette cycles. Get Safe, Target, and Reach indicators across all PMDC-accredited training hospitals — district by district.",
    cta: { href: "/app/merit", label: "View Cutoffs" },
    illustration: "/illustrations/user rank one.svg",
  },
  {
    title: "Simulate your induction",
    eyebrow: "CASCADE ENGINE",
    body: "Test your preference list against the live seat allocation algorithm. See how consent choices cascade across multiple rounds and how your final hospital placement shifts.",
    cta: { href: "/app/portal/allocation", label: "Simulate Cascade" },
    illustration: "/illustrations/man hospital.svg",
  },
];

const EASE = [0.22, 1, 0.36, 1] as const;

// ─── Accordion Row ────────────────────────────────────────────────────────────
function AccordionRow({
  step,
  isOpen,
  onToggle,
}: {
  step: (typeof STEPS)[0];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="border-b border-stone-200 last:border-b-0">
      {/* ── Row header ── */}
      <button
        onClick={onToggle}
        className="w-full text-left py-8 sm:py-10 flex items-center justify-between gap-8 group cursor-pointer focus-visible:outline-none"
        aria-expanded={isOpen}
      >
        {/* Title */}
        <span
          className={`flex-1 font-sans text-3xl sm:text-4xl lg:text-[2.6rem] font-extrabold tracking-tight leading-[1.1] transition-colors duration-300 ${isOpen ? "text-brand-ink" : "text-brand-ink-muted"}`}
        >
          {step.title}
        </span>
      </button>

      {/* ── Expanding body ── */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="body"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.52, ease: EASE },
              opacity: { duration: 0.35, ease: EASE },
            }}
            style={{ overflow: "hidden" }}
          >
            <div className="pt-2 sm:pt-4 pb-10 flex gap-8 items-start">
              {/* Left: text content */}
              <div className="flex-1 pr-4 sm:pr-8 space-y-5 min-w-0">
              {/* Eyebrow label */}
              <p
                className="font-mono text-[10px] font-bold tracking-[0.38em] uppercase text-brand-teal"
              >
                {step.eyebrow}
              </p>

              {/* Body text */}
              <p className="text-[15px] text-stone-500 leading-[1.65] font-medium max-w-[56ch]">
                {step.body}
              </p>



              {/* Underline CTA */}
              <Link
                href={step.cta.href}
                className="inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-ink group/link pt-2"
              >
                <span className="border-b border-stone-300 pb-px transition-colors duration-200 group-hover/link:border-brand-teal group-hover/link:text-brand-teal">
                  {step.cta.label}
                </span>
                <ArrowUpRight className="w-4 h-4 transition-all duration-200 group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 group-hover/link:text-brand-teal" />
              </Link>
              </div>

              {/* Right: Illustration */}
              {step.illustration && (
                <div className="hidden md:flex items-center justify-center shrink-0 w-[260px] lg:w-[320px] p-2 self-center">
                  <Image
                    src={step.illustration}
                    alt={step.title}
                    width={320}
                    height={320}
                    className="object-contain opacity-95 select-none pointer-events-none drop-shadow-md"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
export function HowItWorksSection() {
  // All accordion items expanded by default
  const [openMap, setOpenMap] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: true,
  });

  const toggleRow = (idx: number) => {
    setOpenMap((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <section id="how" className="py-24 md:py-36 px-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[360px_1fr] gap-12 md:gap-16 lg:gap-24 items-start">

        {/* ── LEFT: Sticky header aligned with top accordion heading ── */}
        <div className="md:sticky md:top-32 space-y-8 pt-10 sm:pt-10">
          {/* Headline */}
          <h2 className="font-sans text-4xl sm:text-5xl lg:text-6xl font-black text-brand-ink tracking-tight leading-[1.05]">
            How It<br />
            <span className="font-sans font-black text-brand-teal">Works</span>
          </h2>

          {/* Sub-copy */}
          <p className="text-[14px] text-stone-400 leading-relaxed font-medium max-w-[28ch]">
            Transform raw scores into accurate hospital cutoffs and multi-round seat allocations.
          </p>

          {/* Monospace CTA */}
          <div className="pt-2">
            <Link
              href="/app/calculator"
              className="inline-flex items-center gap-2 group/cta"
            >
              <span className="font-mono text-[11px] font-bold tracking-[0.3em] uppercase border-b border-stone-400 pb-1 transition-colors duration-200 group-hover/cta:border-brand-teal group-hover/cta:text-brand-teal">
                START CALCULATING
              </span>
            </Link>
          </div>
        </div>

        {/* ── RIGHT: Expanded Accordion list ── */}
        <div className="border-t border-stone-200">
          {STEPS.map((step, i) => (
            <AccordionRow
              key={i}
              step={step}
              isOpen={!!openMap[i]}
              onToggle={() => toggleRow(i)}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
