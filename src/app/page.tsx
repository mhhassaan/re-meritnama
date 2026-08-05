"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";

import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { VideoShowcaseSection } from "@/components/landing/video-showcase-section";
import { WhatsInsideSection } from "@/components/landing/whats-inside-section";
import { WhyTrustSection } from "@/components/landing/why-trust-section";
import { EcosystemSection } from "@/components/landing/ecosystem-section";
import { FinalCtaSection } from "@/components/landing/final-cta-section";
import { LandingFooter } from "@/components/landing/landing-footer";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroImageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // HyperFrames GSAP Rule: Gentle Parallax Scrub on Hero Illustration Background
      if (heroImageRef.current) {
        gsap.to(heroImageRef.current, {
          scrollTrigger: {
            trigger: heroImageRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.6,
          },
          yPercent: 12,
          ease: "none",
        });
      }

      // HyperFrames GSAP Rule: Floating Koboyo Cards Continuous Bobbing Motion
      gsap.to(".hero-float-card", {
        y: -10,
        repeat: -1,
        yoyo: true,
        duration: 2.8,
        ease: "sine.inOut",
        stagger: 0.35,
      });

      // Streamlined GSAP ScrollTrigger Reveals for Cards and Sections below the fold
      const revealElements = gsap.utils.toArray<HTMLElement>(".gsap-reveal");
      revealElements.forEach((el) => {
        gsap.from(el, {
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            toggleActions: "play none none reverse",
          },
          y: 20,
          opacity: 0,
          duration: 0.5,
          ease: "power3.out",
        });
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Smooth Scroll Handler using GSAP ScrollToPlugin
  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const targetElement = document.querySelector(targetId);
    if (targetElement) {
      gsap.to(window, {
        duration: 1.2,
        scrollTo: { y: targetElement, offsetY: 80 },
        ease: "power3.inOut",
      });
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-[#FAF9F5] text-[#1A2118] selection:bg-amber-200 selection:text-amber-950 font-sans antialiased">
      {/* Hero Section */}
      <HeroSection heroImageRef={heroImageRef} handleNavClick={handleNavClick} />

      {/* How It Works Section (Connected 3-Step Process Timeline) */}
      <HowItWorksSection />

      {/* Expanded Full-Width Promo Video Showcase */}
      <VideoShowcaseSection />

      {/* What's Inside Section */}
      <WhatsInsideSection />

      {/* Why Trust MeritNama Section */}
      <WhyTrustSection />

      {/* Ecosystem Midnight Olive Section */}
      <EcosystemSection />

      {/* Final CTA Section */}
      <FinalCtaSection />

      {/* Landing Footer */}
      <LandingFooter />
    </div>
  );
}
