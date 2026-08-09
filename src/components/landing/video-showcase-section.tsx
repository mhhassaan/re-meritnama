"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Sparkles, Play, Pause, Volume2, VolumeX, CheckCircle2 } from "lucide-react";

interface StoryStep {
  id: number;
  phase: string;
  badge: string;
  title: string;
  narration: string;
  highlight: string;
}

const STORY_STEPS: StoryStep[] = [
  {
    id: 1,
    phase: "PHASE 01 // MERIT DISCOVERY",
    badge: "3,473 Candidates",
    title: "The Merit Reckoning & Gazette Standings",
    narration: "Your hard work, aggregate calculation, and gazette merit standings are the foundation of your journey.",
    highlight: "Real-time verified induction ranks",
  },
  {
    id: 2,
    phase: "PHASE 02 // PROFESSIONAL TRANSITION",
    badge: "Clinical Readiness",
    title: "Stepping Seamlessly Into Residency",
    narration: "Putting on the white coat and stethoscope — stepping into your professional training with total confidence.",
    highlight: "FCPS / MD / MS pathway clarity",
  },
  {
    id: 3,
    phase: "PHASE 03 // THE CASCADE PATHWAY",
    badge: "115+ Hospital Programs",
    title: "Unrolling Your Specialty Placement Path",
    narration: "A dynamic pathway unrolls beneath your feet, powered by live seat quotas and merit matching intelligence.",
    highlight: "Live cascade algorithm prediction",
  },
  {
    id: 4,
    phase: "PHASE 04 // TEAMWORK & MILESTONES",
    badge: "Accredited Training",
    title: "Milestones, Rotations & Clinical Peers",
    narration: "Checking off every milestone, collaborating with fellow residents, and securing verified credentials.",
    highlight: "Peer network & rotation schedules",
  },
  {
    id: 5,
    phase: "PHASE 05 // THE DESTINATION",
    badge: "Induction Fulfilled",
    title: "Welcome to Your Official Medical Home",
    narration: "Step through the doors of your top-choice teaching hospital. Your residency future starts here.",
    highlight: "100% matched placement certainty",
  },
];

export function VideoShowcaseSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  // Track scroll through the 400vh runway
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Calculate live progress percentage
  const progressPercent = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  // Target time ref for smooth LERP interpolation
  const targetTimeRef = useRef(0);
  const isSeekingRef = useRef(false);

  // Smooth 60fps Damped Video Scrubbing Engine (No Dropped Frames)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let animationFrameId: number;

    // Track scroll changes and update target time without flooding the decoder
    const unsubscribe = scrollYProgress.on("change", (latest) => {
      const stepIdx = Math.min(
        Math.floor(latest * STORY_STEPS.length),
        STORY_STEPS.length - 1
      );
      setActiveStepIndex(stepIdx);

      if (video.duration && !isNaN(video.duration)) {
        targetTimeRef.current = latest * video.duration;
      }
    });

    // High-performance 60fps LERP loop with decoder guard
    const renderLoop = () => {
      if (video.duration && !isNaN(video.duration)) {
        const diff = targetTimeRef.current - video.currentTime;
        
        // If distance is large (fast scroll), jump smoothly; if small, LERP gently
        if (Math.abs(diff) > 0.03 && !video.seeking) {
          // Damped step prevents decoder thrashing and eliminates micro-stutter
          const step = diff * 0.18;
          try {
            video.currentTime += step;
          } catch {
            // Safe fallback
          }
        }
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };

    animationFrameId = requestAnimationFrame(renderLoop);

    const onSeeking = () => { isSeekingRef.current = true; };
    const onSeeked = () => { isSeekingRef.current = false; };

    video.addEventListener("seeking", onSeeking);
    video.addEventListener("seeked", onSeeked);

    return () => {
      unsubscribe();
      cancelAnimationFrame(animationFrameId);
      video.removeEventListener("seeking", onSeeking);
      video.removeEventListener("seeked", onSeeked);
    };
  }, [scrollYProgress]);

  // Toggle video playback
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  // Toggle audio
  const toggleAudio = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  // Jump to specific chapter
  const jumpToStep = (index: number) => {
    if (!containerRef.current) return;
    const containerTop = containerRef.current.offsetTop;
    const containerHeight = containerRef.current.offsetHeight - window.innerHeight;
    const targetScrollY = containerTop + (index / (STORY_STEPS.length - 1)) * containerHeight;
    
    window.scrollTo({
      top: targetScrollY,
      behavior: "smooth",
    });
  };

  return (
    <section
      ref={containerRef}
      id="medical-journey"
      className="relative h-[450vh] bg-brand-cream select-none"
    >
      {/* ── Sticky Full-Screen Scrollytelling Viewport ── */}
      <div className="sticky top-0 flex h-screen w-full flex-col justify-between overflow-hidden p-4 sm:p-8 lg:p-12">
        
        {/* Top Control Bar: Brand + Phase Indicator + Audio/Play buttons */}
        <div className="z-20 mx-auto flex w-full max-w-7xl items-center justify-between rounded-md border border-stone-300/80 bg-brand-cream/90 px-4 py-2.5 backdrop-blur-md shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-mint opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-teal" />
            </span>
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-brand-midnight">
              The Medical Induction Journey
            </span>
          </div>

          {/* Stepper Dots (Clickable) */}
          <div className="hidden sm:flex items-center gap-2">
            {STORY_STEPS.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => jumpToStep(idx)}
                title={step.title}
                className={`group relative flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-[11px] font-mono font-bold transition-all cursor-pointer ${
                  activeStepIndex === idx
                    ? "bg-brand-teal-deep text-white shadow-xs"
                    : "text-stone-600 hover:bg-stone-200/70"
                }`}
              >
                <span>0{step.id}</span>
                {activeStepIndex === idx && (
                  <span className="hidden md:inline font-sans text-[10px] uppercase font-semibold">
                    {step.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Action Triggers: Scrubbing Helper + Sound */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-stone-500 hidden lg:inline">
              SCROLL TO SCRUB VIDEO
            </span>
            <button
              onClick={toggleAudio}
              className="flex h-7 w-7 items-center justify-center rounded-sm border border-stone-300 bg-white text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              title={isMuted ? "Unmute Video" : "Mute Video"}
            >
              {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5 text-brand-teal" />}
            </button>
          </div>
        </div>

        {/* ── Main Video Screen Container ── */}
        <div className="relative my-auto flex w-full items-center justify-center py-2 sm:py-4">
          <div className="relative aspect-video w-full max-w-5xl overflow-hidden rounded-xl border-2 border-stone-300/80 bg-stone-900 shadow-xl">
            {/* The Video Source */}
            <video
              ref={videoRef}
              src="/videos/med_grad.mp4"
              muted={isMuted}
              playsInline
              preload="auto"
              className="h-full w-full object-cover"
            />

            {/* Subtle Gradient Vignette */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

            {/* In-Video Active Phase Pill */}
            <div className="absolute top-4 left-4 z-10">
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-brand-midnight/90 px-3 py-1 font-mono text-[11px] font-bold text-brand-mint backdrop-blur-md border border-brand-mint/30 shadow-md">
                <Sparkles className="h-3.5 w-3.5 text-brand-mint" />
                <span>{STORY_STEPS[activeStepIndex].phase}</span>
              </span>
            </div>

            {/* In-Video Quick Play/Pause Control on Click */}
            <button
              onClick={togglePlay}
              className="absolute bottom-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-transform hover:scale-110 active:scale-95 cursor-pointer border border-white/20"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </button>
          </div>
        </div>

        {/* ── Bottom Synchronized Narrative Caption Card ── */}
        <div className="z-20 mx-auto w-full max-w-5xl">
          <div className="relative overflow-hidden rounded-lg border border-stone-300/80 bg-brand-cream/95 p-4 sm:p-6 shadow-md backdrop-blur-md">
            
            {/* Live Progress Bar along Top Border */}
            <motion.div
              style={{ width: progressPercent }}
              className="absolute top-0 left-0 h-1 bg-gradient-to-r from-brand-teal-deep via-brand-teal to-brand-mint"
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={activeStepIndex}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-brand-teal-deep">
                      STEP 0{STORY_STEPS[activeStepIndex].id} OF 05
                    </span>
                    <span className="text-stone-300">•</span>
                    <span className="flex items-center gap-1 font-mono text-[11px] font-semibold text-brand-teal">
                      <CheckCircle2 className="h-3 w-3" />
                      {STORY_STEPS[activeStepIndex].highlight}
                    </span>
                  </div>

                  <h3 className="font-sans text-lg sm:text-xl font-extrabold text-brand-midnight tracking-tight">
                    {STORY_STEPS[activeStepIndex].title}
                  </h3>
                  
                  <p className="mt-1 font-sans text-xs sm:text-sm text-stone-600 font-medium leading-relaxed">
                    {STORY_STEPS[activeStepIndex].narration}
                  </p>
                </div>

                {/* Right Action Badge */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 border-stone-200 pt-2 sm:pt-0">
                  <span className="rounded bg-teal-50 px-2.5 py-1 font-mono text-xs font-bold text-brand-teal-deep border border-teal-200">
                    {STORY_STEPS[activeStepIndex].badge}
                  </span>
                  <span className="font-mono text-[10px] text-stone-400">
                    Scroll down for next chapter
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>

          </div>
        </div>

      </div>
    </section>
  );
}
