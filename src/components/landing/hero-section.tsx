"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LinkPending } from "@/components/landing/link-pending";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowRight, ArrowDown, Menu, X } from "lucide-react";
import {
  KoboyoStethoscope,
  KoboyoChartNetwork,
} from "@/components/koboyo-icons";

interface HeroSectionProps {
  heroImageRef: React.RefObject<HTMLImageElement | null>;
  handleNavClick: (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => void;
}

/** Single source for both the desktop bar and the mobile drawer, so the two
 *  cannot drift out of sync as sections are added. */
const NAV_LINKS = [
  { href: "#how", label: "How It Works" },
  { href: "#video-showcase", label: "Simulation Preview" },
  { href: "#explore-section", label: "What's Inside" },
  { href: "#trust", label: "Why Trust" },
  { href: "#ecosystem", label: "Induction Ecosystem" },
] as const;

export function HeroSection({ heroImageRef, handleNavClick }: HeroSectionProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Lock body scroll behind the drawer, and close it if the viewport grows to
  // the desktop breakpoint while it is open (otherwise the drawer would stay
  // mounted over a nav bar that is already visible).
  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = (e: MediaQueryListEvent) => {
      if (e.matches) setMenuOpen(false);
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    desktop.addEventListener("change", closeOnDesktop);
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const navVariants: Variants = {
    hidden: { opacity: 0, y: -14, filter: "blur(5px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { type: "spring", damping: 20, stiffness: 160, delay: 0.05 },
    },
  };

  const supportVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", damping: 24, stiffness: 100 },
    },
  };

  const titleContainerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.18, delayChildren: 0.3 },
    },
  };

  const titleLineVariants: Variants = {
    hidden: { opacity: 0, y: 40, filter: "blur(12px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { type: "spring", damping: 30, stiffness: 90, mass: 1.2 },
    },
  };

  const bodyContainerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.13, delayChildren: 0.85 },
    },
  };

  const bodyItemVariants: Variants = {
    hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { type: "spring", damping: 22, stiffness: 110 },
    },
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden font-sans antialiased bg-brand-cream">
      {/* Custom Medical Residency Vector Landscape Artwork with GSAP Parallax */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <img
          ref={heroImageRef}
          src="/data/hero_illust.png"
          alt="Punjab Medical Residency 16:9 Widescreen Landscape"
          className="h-[115%] w-full object-cover object-right-bottom opacity-95 will-change-transform"
        />
        {/* Gentle Gradient Fade Overlay for Maximum Text Contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-cream via-brand-cream/90 to-transparent w-full md:w-3/5" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col justify-between">
        {/* Framer Motion Navbar */}
        <motion.nav
          variants={navVariants}
          initial="hidden"
          animate="show"
          className="flex w-full items-center justify-between px-4 sm:px-8 lg:px-10 py-6"
        >
          <div className="group flex cursor-pointer items-center gap-3">
            <Image
              src="/logo.png"
              alt="MeritNama"
              width={180}
              height={45}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>

          <div className="hidden items-center gap-10 text-sm font-semibold text-brand-ink md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="flex min-h-[40px] items-center transition-colors hover:text-brand-teal"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Header Buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden min-h-[40px] items-center gap-1.5 rounded-sm px-4 py-2 text-[14px] font-semibold text-brand-ink transition-colors hover:text-brand-teal sm:flex"
            >
              <span>Sign In</span>
            </Link>
            <Link
              href="/app"
              className="group flex min-h-[40px] items-center gap-2 rounded-sm bg-brand-teal-deep px-5 py-2.5 text-[14px] font-medium text-white shadow-[0_2px_10px_rgba(0,0,0,0.1)] transition-all duration-150 ease-out will-change-transform hover:bg-brand-teal-deeper active:scale-[0.96]"
            >
              <span>Launch App</span>
              <LinkPending variant="dot" />
              <ArrowRight className="h-4 w-4 text-white transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
            </Link>

            {/* Mobile menu trigger — the section links have no other route in
                below `md`, so this is their only entry point. */}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav-drawer"
              className="flex h-10 w-10 items-center justify-center rounded-sm border border-stone-300/80 bg-white/80 text-brand-ink backdrop-blur-sm transition-colors hover:text-brand-teal active:scale-[0.96] md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </motion.nav>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              key="mobile-nav"
              id="mobile-nav-drawer"
              className="fixed inset-0 z-50 md:hidden"
              initial="hidden"
              animate="show"
              exit="hidden"
            >
              <motion.button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMenuOpen(false)}
                className="absolute inset-0 h-full w-full cursor-default bg-brand-midnight/40 backdrop-blur-sm"
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              />

              <motion.div
                className="absolute inset-x-0 top-0 flex flex-col gap-1 bg-brand-cream px-4 pb-8 pt-6 shadow-2xl"
                variants={{
                  hidden: { y: "-100%" },
                  show: { y: 0 },
                }}
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <Image
                    src="/logo.png"
                    alt="MeritNama"
                    width={180}
                    height={45}
                    className="h-9 w-auto object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Close navigation menu"
                    className="flex h-10 w-10 items-center justify-center rounded-sm border border-stone-300/80 text-brand-ink transition-colors hover:text-brand-teal active:scale-[0.96]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => {
                      setMenuOpen(false);
                      handleNavClick(e, link.href);
                    }}
                    className="flex min-h-[52px] items-center border-b border-stone-200/80 text-base font-semibold text-brand-ink transition-colors active:text-brand-teal"
                  >
                    {link.label}
                  </a>
                ))}

                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="mt-5 flex min-h-[48px] items-center justify-center rounded-sm border border-brand-teal-deep px-5 text-[15px] font-semibold text-brand-teal-deep transition-colors active:scale-[0.98]"
                >
                  Sign In
                </Link>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Hero Content */}
        <main className="flex w-full flex-1 flex-col justify-center px-4 sm:px-8 lg:px-10 pt-10 pb-16 relative">
          {/* HyperFrames Floating Koboyo Hand-Drawn Interactive Cards */}
          <div className="absolute right-12 lg:right-28 xl:right-36 top-1/4 hidden lg:flex flex-col gap-6 z-20 pointer-events-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.8 }}
              className="hero-float-card flex items-center gap-3 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-stone-200/80 hover:scale-105 transition-all cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center p-1.5 shadow-sm">
                <KoboyoStethoscope className="h-5 w-auto text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-brand-ink">100% PHF Policy</p>
                <p className="text-[10px] font-medium text-stone-500">Auto deduction rules</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.3, duration: 0.8 }}
              className="hero-float-card flex items-center gap-3 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-stone-200/80 hover:scale-105 transition-all cursor-pointer ml-8"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center p-1.5 shadow-sm">
                <KoboyoChartNetwork className="h-5 w-auto text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-brand-ink">Cascade Simulator</p>
                <p className="text-[10px] font-medium text-stone-500">Multi-round allocations</p>
              </div>
            </motion.div>
          </div>

          <div className="flex max-w-4xl lg:max-w-5xl flex-col items-start relative z-10">
            {/* Social Proof Avatars */}
            <motion.div
              variants={supportVariants}
              initial="hidden"
              animate="show"
              transition={{ delay: 0.2 }}
              className="mb-8 flex items-center gap-4 cursor-pointer group"
            >
              <div className="flex -space-x-2.5">
                {[
                  "/data/wm_ben.png",
                  "/data/wm_alex.png",
                  "/data/wm_olivia.png",
                  "/data/wm_mia.png",
                ].map((src, i) => (
                  <div
                    key={i}
                    className="h-9 w-9 overflow-hidden rounded-full border-2 border-brand-cream shadow-sm ring-1 ring-black/10 bg-white"
                  >
                    <img
                      src={src}
                      alt={`Candidate ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
              {/* The figure is mono and tabular, like every other number on
                  this site. It was sans-black here, which is a weight nothing
                  else uses for a numeral and read as a different product. */}
              <p className="text-[15px] font-medium text-stone-600">
                <span className="font-mono font-bold tabular-nums text-brand-teal">
                  3,475
                </span>{" "}
                candidate doctors tracked
              </p>
            </motion.div>

            {/* High-Impact Display Headline */}
            <motion.h1
              variants={titleContainerVariants}
              initial="hidden"
              animate="show"
              // One weight and one colour across both lines. It was `font-black`
              // on the first and `font-extrabold text-stone-800` on the second,
              // which made the sentence look like two elements that happened to
              // sit together. The only break is the teal on the word the
              // sketch underline is already marking — `brand-teal`, not
              // `accent`, because this page is theme-invariant and `accent`
              // flips to mint under a dark colour scheme.
              // `max-w-5xl`, matching the column this sits in. At `max-w-4xl` the
              // 88px display could not fit "Know where you stand" and broke
              // "stand" onto a line of its own, which orphaned the verb from
              // its subject and left the sketch underline marking a fragment.
              className="mb-7 max-w-5xl text-5xl font-black leading-[1.05] tracking-tight text-brand-ink sm:text-7xl lg:text-[5.5rem]"
            >
              <motion.span variants={titleLineVariants} className="block">
                Know where you <span className="sketch-underline text-brand-teal">stand</span>
              </motion.span>
              <motion.span variants={titleLineVariants} className="block">
                in Punjab residency induction.
              </motion.span>
            </motion.h1>

            {/* Subtitle + Action CTA Pair */}
            <motion.div
              variants={bodyContainerVariants}
              initial="hidden"
              animate="show"
              className="flex flex-col items-start gap-10"
            >
              {/* `font-medium` on `stone-600`, which is what every other body
                  paragraph on this page is. It was `font-bold text-stone-900`
                  at 24px — the loudest body text on the site, stacked directly
                  under a 88px headline, so the two competed and neither read as
                  the lead. A step larger than a section body is the hero's
                  licence; a second weight of black is not. */}
              <motion.p
                variants={bodyItemVariants}
                className="max-w-xl text-lg font-medium leading-relaxed text-stone-600 sm:text-xl"
              >
                Your merit under the official PHF formula, what every seat
                actually closed at, and how the next round is likely to fall.
              </motion.p>

              {/* Dual Hero Buttons */}
              <motion.div
                variants={bodyItemVariants}
                className="flex flex-wrap items-center gap-5"
              >
                {/* Primary Button */}
                <Link
                  href="/app"
                  className="group flex min-h-[52px] items-center gap-2.5 rounded-sm bg-brand-teal-deep px-8 py-3.5 text-[16px] font-bold text-white shadow-[0_4px_14px_rgba(0,0,0,0.15)] transition-all duration-150 ease-out will-change-transform hover:bg-brand-teal-deeper active:scale-[0.96]"
                >
                  <span>Launch Candidate App</span>
                  <LinkPending variant="dot" />
                  <ArrowRight className="h-5 w-5 text-white transition-transform duration-200 ease-out group-hover:translate-x-1" />
                </Link>

                {/* Secondary Button */}
                <a
                  href="#explore-section"
                  onClick={(e) => handleNavClick(e, "#explore-section")}
                  className="group inline-flex min-h-[52px] items-center gap-2.5 rounded-sm border border-stone-300/90 bg-white/90 px-8 py-3.5 text-[16px] font-bold text-stone-900 shadow-sm transition-all duration-150 ease-out will-change-transform hover:bg-white active:scale-[0.96]"
                >
                  <span>Explore</span>
                  <ArrowRight className="h-5 w-5 text-stone-700 transition-transform duration-200 ease-out group-hover:translate-x-1" />
                </a>
              </motion.div>
            </motion.div>
          </div>
        </main>

        {/* Centered High-Contrast Squared Scroll to Discover Button with Entire-Button Bounce */}
        <div className="flex w-full items-center justify-center pb-12 pt-2 relative z-10">
          <motion.a
            href="#how"
            onClick={(e) => handleNavClick(e, "#how")}
            initial={{ opacity: 0, y: 12 }}
            animate={{
              opacity: 1,
              y: [0, 6, 0],
            }}
            transition={{
              opacity: { duration: 0.5, delay: 1.2 },
              y: {
                duration: 1.6,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="group flex cursor-pointer items-center gap-3 rounded-sm bg-white border border-stone-300/90 px-5 py-2.5 shadow-md hover:border-brand-teal/60 hover:shadow-lg transition-all duration-200"
          >
            <span className="font-mono text-xs font-extrabold tracking-[0.2em] uppercase text-brand-ink group-hover:text-brand-teal transition-colors">
              Scroll to Discover
            </span>
            <div className="w-6 h-6 rounded-sm bg-brand-teal text-white flex items-center justify-center shrink-0 shadow-xs">
              <ArrowDown className="h-3.5 w-3.5 text-white" />
            </div>
          </motion.a>
        </div>
      </div>
    </div>
  );
}
