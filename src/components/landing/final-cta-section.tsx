"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LinkPending } from "@/components/landing/link-pending";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import BorderGlow from "@/components/ui/BorderGlow";
import { BRAND } from "@/lib/design/brand";

const CTA_ILLUSTRATIONS = [
  { src: "/illustrations/doctor.svg", alt: "Doctor Candidate" },
  { src: "/illustrations/doctor 2.svg", alt: "Doctor Resident Specialist" },
  { src: "/illustrations/pill hand.svg", alt: "Medical Training Excellence" },
];

export function FinalCtaSection() {
  const [imgIndex, setImgIndex] = useState(0);

  // Auto-cycle illustrations on their own every 2.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setImgIndex((prev) => (prev + 1) % CTA_ILLUSTRATIONS.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  const currentImg = CTA_ILLUSTRATIONS[imgIndex];
  const isDoctor2 = currentImg.src.includes("doctor 2");

  return (
    <section className="py-24 px-6 max-w-6xl mx-auto">
      <div className="gsap-reveal">
        <BorderGlow
          edgeSensitivity={30}
          glowColor="175 84 32"
          backgroundColor={BRAND.creamDeep}
          borderRadius={28}
          glowRadius={40}
          glowIntensity={1.2}
          coneSpread={25}
          animated={true}
          colors={[BRAND.teal, BRAND.mint, BRAND.ivory]}
        >
          <div className="p-10 sm:p-14 flex flex-col md:flex-row items-center justify-between gap-10 border border-stone-200/80 rounded-3xl">
            
            {/* Left: Text copy and action */}
            <div className="space-y-6 max-w-lg text-left">
              <span className="font-mono text-[11px] font-bold tracking-[0.38em] text-brand-teal uppercase">
                GET STARTED TODAY
              </span>
              <h3 className="font-sans text-3xl sm:text-4xl lg:text-5xl font-black text-brand-ink tracking-tight leading-[1.1]">
                Ready to see where you stand?
              </h3>
              <p className="font-sans text-stone-600 text-base font-medium leading-relaxed">
                Free, independent, and updated every induction cycle for Punjab residency candidates.
              </p>
              <div className="pt-2">
                <Link
                  href="/app"
                  className="group inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-sm bg-brand-teal-deep text-white font-bold text-base hover:bg-brand-teal-deeper transition-all shadow-md active:scale-[0.96]"
                >
                  <span>Launch Candidate App</span>
                  <LinkPending variant="dot" />
                  <ArrowRight className="w-5 h-5 text-white transition-transform duration-200 group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Right: Enlarged auto-cycling illustration container */}
            <div className="shrink-0 w-full md:w-[400px] h-[310px] sm:h-[370px] flex flex-col items-center justify-center relative overflow-visible">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentImg.src}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.03 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full h-full flex items-center justify-center p-2"
                >
                  <Image
                    src={currentImg.src}
                    alt={currentImg.alt}
                    width={450}
                    height={380}
                    className={`h-[260px] sm:h-[320px] w-auto object-contain object-center drop-shadow-sm transition-all duration-300 ${
                      isDoctor2 ? "scale-110 sm:scale-115 translate-x-4 sm:translate-x-6" : ""
                    }`}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Indicator dots for auto-cycle state */}
              <div className="flex items-center gap-1.5 mt-3">
                {CTA_ILLUSTRATIONS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setImgIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === imgIndex ? "w-6 bg-brand-teal" : "w-1.5 bg-stone-300 hover:bg-stone-400"
                    }`}
                  />
                ))}
              </div>
            </div>

          </div>
        </BorderGlow>
      </div>
    </section>
  );
}
