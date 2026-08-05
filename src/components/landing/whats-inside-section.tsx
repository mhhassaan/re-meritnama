"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

const ITEMS = [
  {
    href: "/app.html",
    title: "Analyze",
    eyebrow: "GAZETTE ANALYTICS",
    desc: "Merit tables, score prediction, aggregate calculator, and specialty comparisons across 13 induction cycles.",
    illustration: "/illustrations/checklist.svg",
    alt: "Analyze Merit Checklist",
  },
  {
    href: "/simulation.html",
    title: "Induction Portal",
    eyebrow: "CASCADE SIMULATOR",
    desc: "Live seat allocation simulation, candidate pool browser, and consent what-if preference analysis.",
    illustration: "/illustrations/working simulation.svg",
    alt: "Working Cascade Simulation",
  },
  {
    href: "/app.html#directory",
    title: "Directory",
    eyebrow: "HOSPITALS & SEATS",
    desc: "Every training hospital and CPSP-accredited programme, searchable by specialty, quota, and city.",
    illustration: "/illustrations/man hospital.svg",
    alt: "Punjab Training Hospitals Directory",
  },
  {
    href: "/reviews.html",
    title: "Community",
    eyebrow: "CANDIDATE NETWORK",
    desc: "Discussion forum, live chat during induction rounds, and independent editorial candidate guidance.",
    illustration: "/illustrations/community help.svg",
    alt: "Candidate Doctor Community Help",
  },
];

export function WhatsInsideSection() {
  return (
    <section id="explore-section" className="py-24 md:py-36 px-6 max-w-7xl mx-auto">
      {/* Header matching site layout aesthetic */}
      <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
        <span className="font-mono text-[11px] font-bold tracking-[0.38em] text-[#0D9488] uppercase">
          WHAT&apos;S INSIDE
        </span>
        <h2 className="font-sans text-3xl sm:text-5xl font-black text-[#171717] tracking-tight leading-[1.1]">
          Everything for Punjab’s residency induction, in one place.
        </h2>
        <p className="text-[15px] text-stone-400 font-medium leading-relaxed max-w-lg mx-auto">
          Independent analytics tools, gazette cutoffs, and live allocation engines built for candidate transparency.
        </p>
      </div>

      {/* Borderless grid with prominent enlarged SVG illustrations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
        {ITEMS.map((item, idx) => (
          <Link
            key={idx}
            href={item.href}
            className="group relative p-6 sm:p-7 rounded-3xl border-0 transition-colors duration-200 hover:bg-[#f4f4f0]/80 flex flex-col justify-between items-center text-center"
          >
            <div className="flex flex-col items-center text-center w-full">
              {/* Baseline-aligned Centered SVG Illustration Container */}
              <motion.div
                whileHover={{ scale: 1.05, y: -3 }}
                transition={{ type: "spring", stiffness: 220, damping: 20 }}
                className="w-full h-40 sm:h-44 flex items-end justify-center mb-6 overflow-visible"
              >
                <Image
                  src={item.illustration}
                  alt={item.alt}
                  width={200}
                  height={160}
                  className="h-32 sm:h-36 w-auto object-contain object-bottom drop-shadow-xs"
                />
              </motion.div>

              {/* Title */}
              <h3 className="font-sans text-2xl font-extrabold text-[#171717] tracking-tight mb-2 group-hover:text-[#0D9488] transition-colors duration-200">
                {item.title}
              </h3>

              {/* Description */}
              <p className="font-sans text-[14px] text-stone-500 leading-relaxed font-medium text-center max-w-[28ch] mx-auto text-pretty">
                {item.desc}
              </p>
            </div>

            {/* Eyebrow badge at bottom */}
            <div className="pt-6 mt-4 border-t border-stone-200/50 group-hover:border-stone-300/80 transition-colors w-full text-center">
              <span className="font-mono text-[10px] font-bold tracking-[0.28em] text-stone-400 uppercase group-hover:text-[#0D9488] transition-colors">
                {item.eyebrow}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
