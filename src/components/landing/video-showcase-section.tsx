"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, CheckCircle2 } from "lucide-react";

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

/**
 * The medical-journey scrollytelling section.
 *
 * ## The video plays; it is not scrubbed
 *
 * This used to drive `video.currentTime` from scroll position through a damped
 * loop on every animation frame. That is the reason it felt clunky, and it was
 * never going to stop feeling clunky: seeking an H.264 file lands on the nearest
 * keyframe, not the requested frame, so a smooth scroll produces a sequence of
 * visible jumps whose size depends on how the file was encoded. Writing
 * `currentTime` sixty times a second also keeps the decoder permanently
 * mid-seek, which is what turns a jump into a stall.
 *
 * So the video simply plays, muted and looped, and **scroll drives the
 * narration only**. The chapters still advance with the page, the stepper still
 * jumps, and the motion on screen is now the video's own frame rate rather than
 * a function of the scroll wheel.
 *
 * `prefers-reduced-motion` is honoured by not autoplaying at all — a
 * full-bleed moving background is exactly what that preference is about — and
 * the play control is the way back in.
 *
 * ## Full bleed, with the text over it
 *
 * The video fills the sticky viewport rather than sitting in a bordered card,
 * and the narration sits on it behind a gradient scrim instead of in a panel
 * below it. That is also why the in-video phase pill is gone: it repeated the
 * chapter the caption already names, on top of the picture it was describing.
 */
export function VideoShowcaseSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const progressPercent = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  // Scroll advances the chapter, and nothing else. No decoder is touched.
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (latest) => {
      const stepIdx = Math.min(
        Math.floor(latest * STORY_STEPS.length),
        STORY_STEPS.length - 1
      );
      setActiveStepIndex(stepIdx);
    });
    return () => unsubscribe();
  }, [scrollYProgress]);

  // Autoplay, unless the reader has asked for less motion.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      video.pause();
      setIsPlaying(false);
      return;
    }

    // `play()` rejects if the browser blocks it; that is a normal outcome, not
    // an error, and the control below is then the way in.
    video.play().then(
      () => setIsPlaying(true),
      () => setIsPlaying(false)
    );
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(
        () => setIsPlaying(true),
        () => setIsPlaying(false)
      );
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleAudio = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const jumpToStep = (index: number) => {
    if (!containerRef.current) return;
    const containerTop = containerRef.current.offsetTop;
    const containerHeight =
      containerRef.current.offsetHeight - window.innerHeight;
    const targetScrollY =
      containerTop + (index / (STORY_STEPS.length - 1)) * containerHeight;

    window.scrollTo({ top: targetScrollY, behavior: "smooth" });
  };

  const step = STORY_STEPS[activeStepIndex];

  return (
    <section
      ref={containerRef}
      id="medical-journey"
      // Shorter runway than before. With the video no longer tied to the wheel,
      // the only thing a screen of scrolling buys is the next caption, and five
      // chapters over 450vh made the section feel like it had stalled.
      className="relative h-[320vh] select-none bg-brand-midnight"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* ── The video, full bleed ───────────────────────────────────────── */}
        <video
          ref={videoRef}
          src="/videos/med_grad.mp4"
          muted={isMuted}
          loop
          playsInline
          preload="auto"
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Two scrims, not one gradient across the whole frame. A single ramp
            dark enough to carry a headline at the foot also greys out the
            middle, which is the part of the picture worth looking at. This
            leaves the centre alone and darkens only the two bands that hold
            text — and the bottom one is tall, because the frame it sits on is
            often bright and the eyebrow is a thin mint line. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[22%] bg-gradient-to-b from-brand-midnight/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-brand-midnight via-brand-midnight/88 to-transparent" />

        {/* ── Top row: what this is, which chapter, and sound ─────────────── */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-6 lg:px-12">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-mint opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand-mint" />
            </span>
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-white/90 sm:text-xs">
              The Medical Induction Journey
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Chapter markers. Bars rather than a bordered strip: over a
                picture, a chrome bar reads as a panel stuck to the glass. */}
            <div className="hidden items-center gap-1.5 sm:flex">
              {STORY_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => jumpToStep(idx)}
                  title={s.title}
                  aria-label={`Chapter ${s.id}: ${s.title}`}
                  aria-current={activeStepIndex === idx}
                  className={`h-1 rounded-full transition-all duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
                    activeStepIndex === idx
                      ? "w-10 bg-brand-mint"
                      : "w-5 bg-white/35 hover:bg-white/60"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause video" : "Play video"}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
            >
              {isPlaying ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="ml-0.5 h-3.5 w-3.5" />
              )}
            </button>

            <button
              onClick={toggleAudio}
              title={isMuted ? "Unmute video" : "Mute video"}
              aria-label={isMuted ? "Unmute video" : "Mute video"}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20"
            >
              {isMuted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-brand-mint" />
              )}
            </button>
          </div>
        </div>

        {/* ── The narration, on the picture ───────────────────────────────── */}
        <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-10 sm:px-8 sm:pb-14 lg:px-12">
          <div className="mx-auto w-full max-w-7xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStepIndex}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                className="max-w-3xl"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-brand-mint sm:text-[11px]">
                    {step.phase}
                  </span>
                  <span className="hidden text-white/30 sm:inline">•</span>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-white/70 sm:text-[11px]">
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    {step.highlight}
                  </span>
                </div>

                <h3 className="mt-3 font-sans text-2xl font-black leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-5xl">
                  {step.title}
                </h3>

                <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-white/75 sm:text-base">
                  {step.narration}
                </p>

                <span className="mt-5 inline-flex rounded-sm border border-brand-mint/40 bg-brand-mint/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-mint backdrop-blur-sm sm:text-[11px]">
                  {step.badge}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Progress along the very bottom edge, so it reads as the section's own
            timeline rather than as a control someone might try to drag. */}
        <div className="absolute inset-x-0 bottom-0 z-20 h-[3px] bg-white/10">
          <motion.div
            style={{ width: progressPercent }}
            className="h-full bg-gradient-to-r from-brand-teal via-brand-mint to-brand-mint"
          />
        </div>
      </div>
    </section>
  );
}
