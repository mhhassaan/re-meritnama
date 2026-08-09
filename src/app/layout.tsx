import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "@/lib/design/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairSerif = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "MeritNama — Residency Induction Analytics & Placement Simulation",
  description: "Independent residency induction analytics and cascade seat allocation simulation platform for MBBS/BDS graduates in Punjab, Pakistan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfairSerif.variable} h-full antialiased`}
      // The pre-hydration script below stamps `data-theme` on this element, so
      // the server-rendered markup and the first client render differ by design.
      suppressHydrationWarning
    >
      <head>
        {/* Must run before first paint, ahead of hydration, or a dark-theme
            user sees a flash of the light theme on every navigation. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
