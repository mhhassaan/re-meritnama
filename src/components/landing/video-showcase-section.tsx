"use client";

export function VideoShowcaseSection() {
  return (
    <section id="video-showcase" className="relative w-full h-[60vh] sm:h-[75vh] md:h-[85vh] overflow-hidden bg-[#1A2118]">
      <video
        src="/data/promo.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover block scale-[1.38]"
      />
    </section>
  );
}
