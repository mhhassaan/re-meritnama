"use client";

import { useEffect } from "react";

/**
 * The last resort: a failure in the root layout itself.
 *
 * This replaces the entire document, so it has to bring its own `<html>` and
 * `<body>` — nothing above it survives, including the font variables and the
 * theme tokens. Everything here is therefore inline and literal rather than
 * token-driven, which is the one place in this project where a hardcoded colour
 * is correct: there is no stylesheet guaranteed to have loaded.
 *
 * It also cannot use `next/link`, for the same reason. A plain anchor doing a
 * full navigation is exactly what is wanted when the router is what broke.
 *
 * The colours are the brand midnight ground and the teal accent, matched to the
 * dark theme by hand. A light-theme reader gets a dark page for the two seconds
 * before they reload; that is a better failure than an unstyled one.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.25rem",
          padding: "2rem",
          textAlign: "center",
          background: "#0b201d",
          color: "#e8f2f0",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: "11px",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "#34d399",
          }}
        >
          Error
        </p>

        <h1
          style={{
            margin: 0,
            maxWidth: "18ch",
            fontSize: "clamp(2rem, 6vw, 3rem)",
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          MeritNama could not start
        </h1>

        <p
          style={{
            margin: 0,
            maxWidth: "34rem",
            fontSize: "15px",
            lineHeight: 1.7,
            color: "#9fb8b3",
          }}
        >
          Something failed before the page could be built. Nothing you have saved
          is affected — this happens before anything is read or written.
        </p>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: "46px",
              padding: "0 1.5rem",
              borderRadius: "4px",
              border: "none",
              background: "#14b8a6",
              color: "#05201d",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>

          {/* A plain anchor, not `next/link` — the router is what failed. */}
          <a
            href="/app"
            style={{
              minHeight: "46px",
              display: "inline-flex",
              alignItems: "center",
              padding: "0 1.5rem",
              borderRadius: "4px",
              border: "1px solid #2b4b46",
              color: "#9fb8b3",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            Reload the app
          </a>
        </div>

        {error.digest && (
          <p
            style={{
              margin: 0,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "11px",
              color: "#6b8681",
            }}
          >
            Reference: <strong style={{ color: "#e8f2f0" }}>{error.digest}</strong>
          </p>
        )}
      </body>
    </html>
  );
}
