"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, ArrowUp } from "lucide-react";

export interface Footer15Link {
  label: string;
  href: string;
}

export interface Footer15Column {
  title: string;
  links: Footer15Link[];
}

const defaultColumns: Footer15Column[] = [
  {
    title: "Product",
    links: [
      { label: "Merit Calculator", href: "/app.html" },
      { label: "Cutoff Analytics", href: "/app.html#cutoffs" },
      { label: "Cascade Simulator", href: "/simulation.html" },
      { label: "Hospital Directory", href: "/app.html#directory" },
    ],
  },
  {
    title: "Induction",
    links: [
      { label: "100% PHF Policy", href: "#how" },
      { label: "Gazette Verifier", href: "#trust" },
      { label: "Attempt Deductions", href: "#how" },
      { label: "PMDC Mentors", href: "/reviews.html" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Trainee Forum", href: "/reviews.html" },
      { label: "Live Round Chat", href: "/reviews.html" },
      { label: "Editorial Analysis", href: "#how" },
      { label: "Support Project", href: "mailto:itskaero@gmail.com" },
    ],
  },
  {
    title: "Legal & Source",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
      { label: "Official Disclaimer", href: "#trust" },
      { label: "GitHub (@itskaero)", href: "https://github.com/itskaero" },
    ],
  },
];

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.02,
    },
  },
};

const navStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.01,
    },
  },
};

const riseItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", duration: 0.45, bounce: 0 },
  },
};

const linkStagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.03 } },
};

const linkItem: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", duration: 0.35, bounce: 0 },
  },
};

const ctaVariant: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", duration: 0.4, bounce: 0 },
  },
};

export function LandingFooter() {
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <motion.footer
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -40px 0px" }}
      className="w-full overflow-hidden rounded-t-4xl bg-brand-midnight font-sans antialiased sm:rounded-t-[2.5rem] md:rounded-t-[3rem] border-t border-teal-900/40 relative"
    >
      <motion.div
        variants={staggerContainer}
        className="px-6 pt-12 pb-12 sm:px-10 sm:pt-16 sm:pb-16 lg:px-14 lg:pt-20 xl:px-20"
      >
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-10 lg:flex-row lg:gap-16 xl:gap-20">
          
          {/* Brand Left Column */}
          <motion.div
            variants={riseItem}
            className="flex shrink-0 flex-col gap-5 lg:max-w-[280px] xl:max-w-[300px]"
          >
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="MeritNama"
                width={260}
                height={65}
                className="h-12 sm:h-14 w-auto brightness-200 contrast-200 object-contain object-left"
              />
            </div>

            <p className="text-sm leading-[1.65] font-light text-pretty text-brand-mist">
              Independent residency induction analytics, gazette cutoffs, and seat allocation simulation for MBBS/BDS graduates in Punjab.
            </p>

            {/* Action Buttons: Request Access & Support Project matching site button style */}
            <div className="flex flex-col gap-3 pt-2">
              <motion.a
                href="/app.html"
                variants={ctaVariant}
                whileTap={{ scale: 0.96 }}
                className="group flex min-h-[44px] items-center justify-between gap-2.5 rounded-sm bg-brand-teal-deep px-5 py-3 text-[14px] font-bold text-white shadow-sm transition-all duration-150 ease-out hover:bg-brand-teal-deeper active:scale-[0.96]"
              >
                <span>Request Access</span>
                <ArrowRight className="h-4 w-4 text-white transition-transform duration-200 ease-out group-hover:translate-x-1" />
              </motion.a>

              <motion.a
                href="mailto:itskaero@gmail.com"
                variants={ctaVariant}
                whileTap={{ scale: 0.96 }}
                className="group flex min-h-[44px] items-center justify-between gap-2.5 rounded-sm border border-stone-700/80 bg-stone-800/80 px-5 py-3 text-[14px] font-bold text-brand-ivory shadow-sm transition-all duration-150 ease-out hover:bg-stone-700 active:scale-[0.96]"
              >
                <span>Support Project</span>
                <ArrowRight className="h-4 w-4 text-brand-ivory transition-transform duration-200 ease-out group-hover:translate-x-1" />
              </motion.a>
            </div>
          </motion.div>

          {/* Navigation Links Columns + Back to Top Action */}
          <div className="flex flex-col justify-between gap-8 w-full max-w-[680px]">
            <div className="flex items-center justify-between pb-2 border-b border-teal-900/40">
              <span className="font-mono text-[11px] font-bold tracking-[0.3em] text-brand-teal uppercase">
                PUNJAB RESIDENCY SUITE
              </span>

              {/* Move to Top Accessibility Button (Squared rounded-sm) */}
              <motion.button
                onClick={scrollToTop}
                whileHover={{ scale: 1.04, y: -2 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Scroll back to top of page"
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-sm bg-teal-950/90 border border-teal-800/70 text-xs font-bold text-brand-ivory hover:text-white hover:border-teal-400 transition-all cursor-pointer shadow-xs"
              >
                <span>Back to Top</span>
                <ArrowUp className="w-3.5 h-3.5 text-brand-teal" />
              </motion.button>
            </div>

            <motion.nav
              variants={navStagger}
              aria-label="Footer navigation"
              className="grid w-full grid-cols-2 gap-y-10 sm:grid-cols-4"
            >
              {defaultColumns.map((col) => (
                <motion.div key={col.title} variants={riseItem}>
                  <h3 className="text-sm font-bold tracking-wider uppercase text-brand-ivory">
                    {col.title}
                  </h3>
                  <motion.ul
                    variants={linkStagger}
                    className="mt-4 flex flex-col gap-3"
                  >
                    {col.links.map((link) => (
                      <motion.li key={link.label} variants={linkItem}>
                        <Link
                          href={link.href}
                          className="inline-block text-xs leading-none font-medium text-brand-mist transition-colors duration-200 hover:text-white"
                        >
                          {link.label}
                        </Link>
                      </motion.li>
                    ))}
                  </motion.ul>
                </motion.div>
              ))}
            </motion.nav>
          </div>
        </div>
      </motion.div>
    </motion.footer>
  );
}
