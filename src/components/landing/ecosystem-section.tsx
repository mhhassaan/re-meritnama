"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { ArrowUpRight, CheckCircle2, Shield, Activity, Radio, Briefcase, Calculator } from "lucide-react";
import {
  KoboyoCalculator,
  KoboyoChartNetwork,
  KoboyoBriefcaseMedical,
  KoboyoApprovedDocument,
  KoboyoChart,
  KoboyoHospital,
} from "@/components/koboyo-icons";

interface EcosystemCardData {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  telemetryLabel: string;
  telemetryIcon: React.ComponentType<{ className?: string }>;
  statusBadge: string;
  statusBadgeColor?: string;
}

const ECOSYSTEM_CARDS: EcosystemCardData[] = [
  {
    title: "PMDC Identity & Gazette Verifier",
    description: "Automated verification system authenticating candidate PMDC numbers and official PHF gazette release hashes.",
    icon: KoboyoApprovedDocument,
    telemetryLabel: "PMDC Gazette Hash",
    telemetryIcon: Shield,
    statusBadge: "SHA-256 Verified",
    statusBadgeColor: "text-brand-mint",
  },
  {
    title: "Residency Preference Sandbox",
    description: "Test complex hospital/specialty orderings in a risk-free sandbox before submitting your final consent list to PHF.",
    icon: KoboyoChartNetwork,
    telemetryLabel: "Attempt Deductions",
    telemetryIcon: Calculator,
    statusBadge: "Auto-Calculated",
    statusBadgeColor: "text-brand-mint",
  },
  {
    title: "Post-Residency Jobs Board",
    description: "Listings for Senior Registrars, Medical Officers, and post-FCPS fellowship opportunities across Punjab hospitals.",
    icon: KoboyoBriefcaseMedical,
    telemetryLabel: "Active Postings",
    telemetryIcon: Briefcase,
    statusBadge: "Senior Registrars",
    statusBadgeColor: "text-brand-mint",
  },
  {
    title: "Queue Delta & Live Round Tracker",
    description: "Real-time telemetry tracking merit rank movements, seat releases, and upgrade deltas between induction rounds.",
    icon: KoboyoChart,
    telemetryLabel: "Live Rank Deltas",
    telemetryIcon: Activity,
    statusBadge: "Round 1 & 2 Live",
    statusBadgeColor: "text-brand-mint",
  },
  {
    title: "Attempt Deduction Rules Engine",
    description: "Algorithmic engine computing penalty mark deductions (-1 to -3 marks) per repeat attempt & cross-quota multiplier.",
    icon: KoboyoCalculator,
    telemetryLabel: "PHF Policy Standard",
    telemetryIcon: CheckCircle2,
    statusBadge: "100% Verified",
    statusBadgeColor: "text-brand-mint",
  },
  {
    title: "War Room Telemetry Grid",
    description: "Mission control tile grid tracking real-time seat availability across 42 Punjab medical institutions during consent hours.",
    icon: KoboyoHospital,
    telemetryLabel: "42 Punjab Hospitals",
    telemetryIcon: Radio,
    statusBadge: "Active Telemetry",
    statusBadgeColor: "text-brand-mint",
  },
];

export function EcosystemSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  // Calm, relaxed translation ratio (-38%) for easy reading speed
  const rawX = useTransform(scrollYProgress, [0, 1], ["0%", "-38%"]);

  // Luxurious low-stiffness physical spring damper filtering out wheel jumps for velvety glide
  const smoothX = useSpring(rawX, {
    stiffness: 45,
    damping: 24,
    mass: 1.1,
    restDelta: 0.0001,
  });

  return (
    <section ref={sectionRef} id="ecosystem" className="relative bg-brand-midnight text-white h-[220vh]">
      {/* Sticky Viewport pinned while user scrolls through relaxed 220vh runway */}
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden py-8 px-6 sm:px-10">
        
        {/* Background Ambient Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-brand-teal/10 blur-[140px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto w-full relative z-10">
          
          {/* Header with Koboyo Sparkle Stars */}
          <div className="gsap-reveal text-center max-w-2xl mx-auto mb-10 space-y-3">
            <div className="flex items-center justify-center gap-2 text-brand-ivory">
              <span className="font-mono text-[11px] font-bold tracking-[0.38em] text-brand-ivory uppercase">
                EXTENDED SUITE
              </span>
            </div>

            <h2 className="font-sans text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.1]">
              Specialized tools for every stage of your career.
            </h2>
            <p className="font-sans text-stone-300 text-sm sm:text-base font-medium leading-relaxed max-w-lg mx-auto">
              Beyond induction cutoffs: identity verification, preference sandboxing, and post-residency career support.
            </p>
          </div>

          {/* Prominent Logo & Duplicated Loop Horizontal Cards Track */}
          {/* Edge fade is an alpha mask on the track, not an opaque gradient
              overlay. An overlay only spans its own width (112px) while a card
              is 290-390px wide, so a partially-visible card had a wash drawn
              across its title and read as a rendering fault. Masking fades the
              card itself, so it leaves the runway cleanly at any scroll offset.

              The fade is a **fixed 18px** below `sm` and a percentage above it,
              because a percentage is measured against the runway and the runway
              on a phone is barely wider than one card. Measured at a 500px
              viewport: a 442px runway, a 340px card, and 14% each side put 62px
              of fade on both edges — 36% of the card washed out, which is what
              made it look hidden rather than framed. A percentage is right on a
              wide screen, where 14% of 1400px is a generous 196px of runway and
              lands on the gaps between cards. */}
          <div
            className="relative overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent_0px,black_18px,black_calc(100%-18px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0px,black_18px,black_calc(100%-18px),transparent_100%)] sm:[mask-image:linear-gradient(to_right,transparent_0%,black_14%,black_86%,transparent_100%)] sm:[-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_14%,black_86%,transparent_100%)]"
          >
            <motion.div
              style={{ x: smoothX }}
              className="flex gap-6 sm:gap-7 w-max transform-gpu will-change-transform"
            >
              {/* Tripled Array (18 cards total) for continuous seamless loop without empty space */}
              {[1, 2, 3].map((setIndex) => (
                <div key={setIndex} className="flex gap-6 sm:gap-7 shrink-0">
                  {ECOSYSTEM_CARDS.map((card, idx) => {
                    const IconComponent = card.icon;
                    const TelemetryIcon = card.telemetryIcon;
                    return (
                      <motion.div
                        key={`${setIndex}-${idx}`}
                        whileHover={{ y: -6, scale: 1.02 }}
                        transition={{ type: "spring", stiffness: 220, damping: 20 }}
                        className="w-[290px] sm:w-[390px] h-[340px] shrink-0 rounded-3xl bg-brand-midnight-raised/95 border border-transparent p-7 flex flex-col justify-between relative overflow-hidden group shadow-xl select-none"
                      >
                        {/* Top Header Row with Prominent Hero Icon Badge */}
                        <div>
                          <div className="flex items-center justify-between gap-4 mb-5">
                            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-teal-900/80 border border-teal-600/60 flex items-center justify-center shrink-0 text-brand-ivory group-hover:scale-110 group-hover:border-brand-ivory/80 transition-all duration-300 shadow-md">
                              <IconComponent className="h-7 w-auto text-brand-ivory sm:h-8" />
                            </div>
                            <ArrowUpRight className="w-5 h-5 text-stone-400 group-hover:text-brand-ivory transition-colors shrink-0" />
                          </div>

                          {/* Title & Description */}
                          <h3 className="font-sans text-xl sm:text-2xl font-extrabold text-white tracking-tight mb-2 min-h-[52px] flex items-center leading-snug">
                            {card.title}
                          </h3>
                          <p className="font-sans text-xs text-stone-300 font-medium leading-relaxed">
                            {card.description}
                          </p>
                        </div>

                        {/* Standardized Bottom Telemetry Footer */}
                        <div className="w-full bg-brand-midnight-deep rounded-md border border-teal-900/80 p-3 px-3.5 font-mono text-xs text-stone-300 flex items-center justify-between shadow-inner mt-3">
                          <span className="flex items-center gap-2 font-bold text-stone-300 text-[11px]">
                            <TelemetryIcon className="w-3.5 h-3.5 text-brand-ivory shrink-0" />
                            {card.telemetryLabel}
                          </span>
                          <span className={`text-[11px] font-bold ${card.statusBadgeColor || "text-brand-mint"}`}>
                            {card.statusBadge}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
