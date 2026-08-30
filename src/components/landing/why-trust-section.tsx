"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import {
  KoboyoShield,
  KoboyoApprovedDocument,
  KoboyoStethoscope,
} from "@/components/koboyo-icons";

const CARDS_DATA = [
  {
    id: 0,
    title: "Independent",
    desc: "Built & maintained independently — 0 institutional agenda.",
    illustration: "/illustrations/user with card and list.svg",
    alt: "Independent Candidate Platform",
    positionClass: "top-0 -left-2",
    baseRotation: -3,
  },
  {
    id: 1,
    title: "Official Gazette Data",
    desc: "Sourced directly from official PHF merit lists.",
    illustration: "/illustrations/approved.svg",
    alt: "Official PHF Gazette Approved",
    positionClass: "top-16 -right-2",
    baseRotation: 3,
  },
  {
    id: 2,
    title: "Community Verified",
    desc: "Audited & verified by real resident doctors.",
    illustration: "/illustrations/comminity.svg",
    alt: "Community Verified Trainees",
    positionClass: "top-72 left-2",
    baseRotation: -2,
  },
  {
    id: 3,
    title: "Always Verify Officially",
    desc: "Confirm predictions with official PHF guidelines.",
    illustration: "/illustrations/man rating.svg",
    alt: "Official Rating Verification",
    positionClass: "bottom-2 right-0",
    baseRotation: 2,
  },
];

export function WhyTrustSection() {
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [zIndices, setZIndices] = useState<Record<number, number>>({
    0: 10,
    1: 20,
    2: 30,
    3: 40,
  });
  const [topZ, setTopZ] = useState<number>(40);

  const handleCardHover = (id: number) => {
    setHoveredCard(id);
    setZIndices((prev) => {
      if (prev[id] === topZ) return prev;
      const nextTop = topZ + 1;
      setTopZ(nextTop);
      return { ...prev, [id]: nextTop };
    });
  };

  return (
    <section id="trust" className="py-24 sm:py-32 px-6 bg-brand-cream-deep text-brand-ink">
      <div className="mx-auto grid max-w-7xl items-start gap-12 lg:gap-16 lg:grid-cols-2">
        
        {/* Left Column: Headline, Copy & Koboyo Icon Bullets */}
        <div className="space-y-8">
          <div className="space-y-4">
            <span className="font-mono text-[11px] font-bold tracking-[0.38em] text-brand-teal uppercase">
              WHY TRUST MERITNAMA
            </span>
            <h2 className="font-sans text-3xl sm:text-5xl font-black text-brand-ink tracking-tight leading-[1.1]">
              Built for candidate transparency and data accuracy.
            </h2>
            <p className="font-sans text-stone-600 text-base font-medium leading-relaxed max-w-lg">
              Independent analytics tools, verified gazette cutoffs, and live allocation engines built for Punjab MBBS & BDS graduates.
            </p>
          </div>

          {/* Left Bullet Points with Hand-Drawn Koboyo Icons */}
          <div className="space-y-4">
            <div className="flex items-center gap-3.5 text-sm font-bold text-brand-ink">
              <div className="w-9 h-9 rounded-xl bg-brand-teal/10 flex items-center justify-center shrink-0">
                <KoboyoShield className="h-5 w-auto text-brand-teal" />
              </div>
              <span>Zero institutional bias or commercial agenda</span>
            </div>

            <div className="flex items-center gap-3.5 text-sm font-bold text-brand-ink">
              <div className="w-9 h-9 rounded-xl bg-brand-teal/10 flex items-center justify-center shrink-0">
                <KoboyoApprovedDocument className="h-5 w-auto text-brand-teal" />
              </div>
              <span>100% verified against Punjab Health Foundation Gazette</span>
            </div>

            <div className="flex items-center gap-3.5 text-sm font-bold text-brand-ink">
              <div className="w-9 h-9 rounded-xl bg-brand-teal/10 flex items-center justify-center shrink-0">
                <KoboyoStethoscope className="h-5 w-auto text-brand-teal" />
              </div>
              <span>Reviewed and audited by active FCPS/MD resident doctors</span>
            </div>
          </div>

          <div className="pt-2">
            <Link
              href="/app/merit-lists"
              className="group inline-flex items-center gap-2.5 rounded-sm bg-brand-teal-deep px-7 py-3.5 text-sm font-bold text-white shadow-md hover:bg-brand-teal-deeper transition-all active:scale-[0.96]"
            >
              <span>Verify Official Gazette Data</span>
              <ArrowRight className="h-4 w-4 text-white transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        {/* Right Column: Watermelon UI Feature-5 Persistent Layering Stacked Deck */}
        <div className="bg-brand-cream border border-stone-200/90 rounded-3xl p-6 sm:p-10 relative flex justify-center items-center shadow-xs overflow-hidden min-h-[640px] sm:min-h-[680px] lg:mt-1">
          <div className="relative h-[580px] sm:h-[620px] w-full max-w-lg">
            {CARDS_DATA.map((card) => {
              const isCurrentlyHovered = hoveredCard === card.id;
              const zIndex = zIndices[card.id] ?? 10;
              const scale = isCurrentlyHovered ? 1.05 : 1;
              const rotate = isCurrentlyHovered ? 0 : card.baseRotation;

              return (
                <motion.div
                  key={card.id}
                  onMouseEnter={() => handleCardHover(card.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  animate={{
                    scale,
                    rotate,
                    zIndex,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 150,
                    damping: 20,
                    mass: 0.8,
                  }}
                  className={`absolute ${card.positionClass} w-[270px] sm:w-[300px] rounded-2xl border-0 bg-white p-6 shadow-[0_14px_35px_rgba(0,0,0,0.1)] transform-gpu will-change-transform cursor-pointer transition-shadow duration-300 ${
                    isCurrentlyHovered ? "shadow-[0_24px_55px_rgba(0,0,0,0.18)]" : ""
                  }`}
                >
                  <div className="w-full h-32 sm:h-36 flex items-center justify-center mb-4 overflow-visible">
                    <Image
                      src={card.illustration}
                      alt={card.alt}
                      width={180}
                      height={120}
                      className="h-full w-auto object-contain drop-shadow-xs"
                    />
                  </div>
                  <h4 className="font-sans font-extrabold text-brand-teal text-lg mb-1.5">
                    {card.title}
                  </h4>
                  <p className="font-sans text-xs text-stone-600 leading-relaxed font-medium">
                    {card.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
