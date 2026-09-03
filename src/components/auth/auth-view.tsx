"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Mail,
  Upload,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { AuthHashError } from "@/components/auth/auth-hash-error";

interface AuthViewProps {
  initialMode?: "signin" | "signup" | "request" | "proof";
}

export function AuthView({ initialMode = "signin" }: AuthViewProps) {
  const [activeTab, setActiveTab] = useState<"signin" | "request" | "proof">(
    initialMode === "signup" ? "request" : initialMode
  );

  // One client per mount; re-creating it on each render would drop the session
  // listener and re-run auth storage setup.
  const supabase = useMemo(() => createClient(), []);

  const searchParams = useSearchParams();
  // Only same-origin relative paths are honoured, so a crafted ?next= cannot
  // turn sign-in into an open redirect to an attacker's site.
  const requestedNext = searchParams.get("next") ?? "";
  const callbackError = searchParams.get("error") ?? "";
  const nextPath =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/app";

  // Form States
  // 1. Sign In Form
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPin, setSignInPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState("");
  const [signInSuccess, setSignInSuccess] = useState("");
  const [resetPending, setResetPending] = useState(false);

  // Supabase returns link failures in the URL fragment, which never reaches the
  // server. When one is present it explains the failure precisely, so the
  // callback route's generic "missing token" message is suppressed.
  const [hasHashError, setHasHashError] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.location.hash) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.get("error") || params.get("error_code")) setHasHashError(true);
  }, []);

  // 2. Request Access Form
  const [reqEmail, setReqEmail] = useState("");
  const [reqApplicantId, setReqApplicantId] = useState("");
  const [reqMsg, setReqMsg] = useState("");
  // Sent with the request but not collected: the form has no payment fields
  // yet, so these three were `useState` whose setters were never called. Plain
  // constants until that UI exists — state nothing can change is not state.
  const reqPaymentDeclared = true;
  const reqPayAmount = "2000";
  const reqPayRef = "";
  const [reqMatchedCandidate, setReqMatchedCandidate] = useState<{ nameFull: string; applicantId: string } | null>(null);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState("");
  const [reqSuccess, setReqSuccess] = useState("");

  // 3. Payment Proof Form
  const [proofEmail, setProofEmail] = useState("");
  const [proofMsg, setProofMsg] = useState("");
  const [proofImageBase64, setProofImageBase64] = useState<string>("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState("");
  const [proofSuccess, setProofSuccess] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sign in against Supabase Auth.
  //
  // Replaces the original scheme, which hashed a PIN in the browser, compared it
  // to a publicly-served index, and wrote a 24-hour session into localStorage —
  // a check performed entirely by code the attacker controls. Supabase issues a
  // signed token the database itself verifies on every request.
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError("");
    setSignInSuccess("");

    const email = signInEmail.trim().toLowerCase();
    const password = signInPin;

    if (!email || !password) {
      setSignInError("Please enter both your registered email and password.");
      return;
    }

    setSignInLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // One message for wrong password and unknown account alike: distinguishing
      // them tells an attacker which addresses are registered.
      setSignInError("Incorrect email or password.");
      setSignInLoading(false);
      return;
    }

    // Both data tiers require a confirmed address, so signing in without one
    // would land the user on an app that renders nothing.
    if (!data.user?.email_confirmed_at) {
      setSignInError(
        "Please confirm your email address first — check your inbox for the link we sent."
      );
      await supabase.auth.signOut();
      setSignInLoading(false);
      return;
    }

    setSignInSuccess("Signed in. Opening your portal…");
    // Full navigation rather than a client transition, so the server re-reads
    // the freshly-set auth cookies.
    window.location.assign(nextPath);
  };

  // Send a password reset link.
  //
  // Always reports success, whatever happened. Saying "no account with that
  // email" would turn this button into a membership oracle — and membership here
  // means "is an Induction 21 candidate", which is precisely what must not be
  // confirmable to a stranger.
  const handleForgotPassword = async () => {
    setSignInError("");
    setSignInSuccess("");

    const email = signInEmail.trim().toLowerCase();
    if (!email) {
      setSignInError("Enter your email address first, then choose 'Forgot your password?'.");
      return;
    }

    setResetPending(true);
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
    });
    setResetPending(false);

    setSignInSuccess(
      "If that address has an account, a reset link is on its way. It expires shortly."
    );
  };

  // Submit an access request.
  //
  // Verification happens on the server: the candidate index is never sent to the
  // browser. The original fetched `candidate_auth_index.json` — every registered
  // email plus an unsalted SHA-256 of the applicant id — purely to run this
  // check client-side.
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqError("");
    setReqSuccess("");

    if (!reqEmail.trim() || !reqApplicantId.trim()) {
      setReqError("Please provide your induction portal email and Applicant ID.");
      return;
    }

    setReqLoading(true);

    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: reqEmail.trim(),
          applicantId: reqApplicantId.trim(),
          message: reqMsg.trim(),
          paymentDeclared: reqPaymentDeclared,
          paymentAmountPkr: reqPayAmount,
          paymentReference: reqPayRef.trim(),
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        setReqError(body.error ?? "Could not submit your request. Please try again.");
        setReqMatchedCandidate(null);
      } else {
        // The server echoes the matched name so the candidate can confirm the
        // right record was found. Nothing else about the record is returned.
        if (body.nameFull) {
          setReqMatchedCandidate({
            nameFull: body.nameFull,
            applicantId: reqApplicantId.trim(),
          });
        }
        setReqSuccess(body.message ?? "Request submitted.");
      }
    } catch {
      setReqError("Network error. Please check your connection and try again.");
    } finally {
      setReqLoading(false);
    }
  };

  // Preview only. The ORIGINAL file is uploaded, not a re-encode: the original
  // downscaled to 800px and re-compressed as JPEG, which is fine for a thumbnail
  // and useless as evidence — account numbers and transaction ids in a bank
  // screenshot stop being legible. Size is enforced server-side instead.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProofError("");
    setProofFile(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => setProofImageBase64(String(event.target?.result ?? ""));
      reader.readAsDataURL(file);
    } else {
      setProofImageBase64("");
    }
  };

  // Handle Proof Submit
  // Submit payment proof.
  //
  // Multipart rather than a base64 JSON body: a bank screenshot is evidence and
  // is uploaded intact. The server re-validates size and sniffs the real file
  // type, since both are attacker-controlled here.
  const handleProofSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProofError("");
    setProofSuccess("");

    if (!proofEmail.trim()) {
      setProofError("Please enter the email you used for your access request.");
      return;
    }
    if (!proofFile && !proofMsg.trim()) {
      setProofError("Attach a payment screenshot, or write a message.");
      return;
    }

    setProofLoading(true);

    try {
      const body = new FormData();
      body.set("email", proofEmail.trim());
      body.set("message", proofMsg.trim());
      if (proofFile) body.set("file", proofFile);

      const res = await fetch("/api/payment-proof", { method: "POST", body });
      const result = await res.json();

      if (!res.ok) {
        setProofError(result.error ?? "Could not submit your payment proof.");
      } else {
        setProofSuccess(result.message ?? "Payment proof received.");
        setProofFile(null);
        setProofImageBase64("");
      }
    } catch {
      setProofError("Network error. Please check your connection and try again.");
    } finally {
      setProofLoading(false);
    }
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.04, delayChildren: 0 },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 8, filter: "blur(2px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { type: "spring", stiffness: 350, damping: 25 },
    },
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-background font-sans text-foreground antialiased selection:bg-accent-quiet selection:text-accent-strong lg:flex-row">
      {/* Auth is the entry point to the app rather than a marketing page, so it
          is theme-aware and carries its own theme control. */}
      <div className="absolute right-4 top-4 z-30 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>


      {/* ── LEFT PANEL: Clean Minimal Gradient Mesh, Upper-Middle Logo & Text ── */}
      {/* Below `lg` the two panels stack, so the brand panel sizes to its own
          content instead of claiming half the viewport — it previously pushed
          the sign-in form entirely below the fold on a phone. The `lg:pt-48`
          value is unchanged, preserving the side-by-side baseline alignment
          with the form panel. */}
      <div className="relative flex w-full flex-col justify-start items-center overflow-hidden bg-brand-midnight px-8 pb-10 pt-14 md:px-12 lg:w-1/2 lg:min-h-screen lg:p-12 text-white select-none sm:pt-20 lg:pt-48">
        
        {/* Pure Multi-Layered Custom Color Palette Gradient Mesh (No Photo Image) */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-brand-midnight-deep via-brand-midnight to-brand-midnight-abyss">
          <div className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[550px] bg-gradient-to-b from-brand-teal/30 via-brand-midnight-raised/20 to-transparent blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-t from-brand-midnight-abyss via-brand-teal/20 to-transparent blur-[140px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-mint/10 blur-[160px] rounded-full pointer-events-none" />
        </div>

        {/* Elevated Logo & Text Content */}
        <div className="relative z-10 flex w-full flex-col items-center justify-center text-center max-w-xl mx-auto px-4">
          {/* Prominent Enlarged Logo Above Text */}
          <Link href="/" className="inline-block mb-8 transition-transform hover:scale-105">
            <Image
              src="/logo.png"
              alt="MeritNama"
              width={320}
              height={80}
              className="h-14 sm:h-16 lg:h-20 w-auto object-contain brightness-0 invert drop-shadow-md"
              priority
            />
          </Link>

          <p className="mb-3 text-base md:text-lg font-medium text-brand-ivory/90 font-sans tracking-wide">
            You can easily
          </p>
          <h1 className="font-sans text-2xl sm:text-4xl lg:text-5xl font-semibold leading-[1.2] tracking-tight text-white">
            Get access to your personal
            <br />
            hub for clarity and
            <br />
            cascade intelligence
          </h1>
        </div>
      </div>

      {/* ── RIGHT PANEL: Auth Card Form (Watermelon auth-10 layout + MeritNama DESIGN_GUIDELINES.md) ── */}
      {/* In dark the form panel's background and the brand panel's midnight are
          near-identical, so the split-panel structure needs an explicit seam or
          it reads as one flat surface. */}
      <div className="flex w-full flex-col justify-start items-center border-t border-border p-6 pt-8 sm:p-12 sm:pt-10 lg:w-1/2 lg:min-h-screen lg:border-t-0 lg:border-l lg:p-16 lg:pt-48">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md"
        >
          {/* 3 Auth Navigation Tabs with Watermelon auth-10 layoutId sliding spring pill */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="relative grid grid-cols-3 gap-1 rounded-lg bg-surface-sunken/80 p-1 font-mono text-[11px] font-bold border border-border-strong/70">
              <button
                type="button"
                onClick={() => setActiveTab("signin")}
                className={`relative z-10 rounded-md px-2.5 py-2 text-center transition-colors duration-150 ${
                  activeTab === "signin"
                    ? "text-accent-strong font-extrabold"
                    : "text-fg-muted hover:text-foreground"
                }`}
              >
                {activeTab === "signin" && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 z-[-1] rounded-md bg-surface shadow-sm border border-border/80"
                    transition={{ type: "spring", stiffness: 550, damping: 35 }}
                  />
                )}
                SIGN IN
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("request")}
                className={`relative z-10 rounded-md px-2.5 py-2 text-center transition-colors duration-150 ${
                  activeTab === "request"
                    ? "text-accent-strong font-extrabold"
                    : "text-fg-muted hover:text-foreground"
                }`}
              >
                {activeTab === "request" && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 z-[-1] rounded-md bg-surface shadow-sm border border-border/80"
                    transition={{ type: "spring", stiffness: 550, damping: 35 }}
                  />
                )}
                REQUEST
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("proof")}
                className={`relative z-10 rounded-md px-2.5 py-2 text-center transition-colors duration-150 ${
                  activeTab === "proof"
                    ? "text-accent-strong font-extrabold"
                    : "text-fg-muted hover:text-foreground"
                }`}
              >
                {activeTab === "proof" && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 z-[-1] rounded-md bg-surface shadow-sm border border-border/80"
                    transition={{ type: "spring", stiffness: 550, damping: 35 }}
                  />
                )}
                PAYMENT
              </button>
            </div>
          </motion.div>

          {/* Tab Views Wrapper with fixed minimum height so container never resizes */}
          <div className="relative min-h-[540px]">
            <AnimatePresence mode="wait" initial={false}>
              {activeTab === "signin" && (
                <motion.div
                  key="tab-signin"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.09 }}
                >
                  <motion.div variants={itemVariants} className="mb-6">
                    <h2 className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                      Private Access
                    </h2>
                    <p className="font-sans text-sm text-fg-subtle font-medium mt-1.5">
                      Enter your registered email and password to open your candidate portal.
                    </p>
                  </motion.div>

                  <form onSubmit={handleSignIn} className="flex flex-col gap-4">
                    {/* Email Address */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label htmlFor="signInEmail" className="font-sans text-xs font-bold uppercase tracking-wider text-fg-muted">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
                        <input
                          id="signInEmail"
                          type="email"
                          required
                          autoComplete="email"
                          suppressHydrationWarning
                          placeholder="your@email.com"
                          value={signInEmail}
                          onChange={(e) => setSignInEmail(e.target.value)}
                          className="w-full rounded-sm border border-border-strong/90 bg-surface pl-10 pr-4 py-3 font-mono text-sm text-foreground placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                        />
                      </div>
                    </motion.div>

                    {/* Password Input */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label htmlFor="signInPin" className="font-sans text-xs font-bold uppercase tracking-wider text-fg-muted">
                        Password
                      </label>
                      <div className="relative">
                        <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
                        <input
                          id="signInPin"
                          type={showPin ? "text" : "password"}
                          required
                          autoComplete="current-password"
                          placeholder="••••••••"
                          value={signInPin}
                          onChange={(e) => setSignInPin(e.target.value)}
                          className="w-full rounded-sm border border-border-strong/90 bg-surface pl-10 pr-10 py-3 font-mono text-sm text-foreground placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted"
                        >
                          {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </motion.div>

                    {/* Feedback Messages.
                        `callbackError` carries failures from the emailed-link
                        handler (expired or already-used links), which would
                        otherwise vanish on redirect with no explanation. */}
                    <AuthHashError />

                    {!signInError && callbackError && !hasHashError && (
                      <motion.div variants={itemVariants} className="flex items-center gap-2 rounded-sm border border-status-danger bg-status-danger-quiet p-3 text-xs font-medium text-status-danger">
                        <AlertCircle className="h-4 w-4 shrink-0 text-status-danger" />
                        <span>{callbackError}</span>
                      </motion.div>
                    )}

                    {signInError && (
                      <motion.div variants={itemVariants} className="flex items-center gap-2 rounded-sm border border-status-danger bg-status-danger-quiet p-3 text-xs font-medium text-status-danger">
                        <AlertCircle className="h-4 w-4 shrink-0 text-status-danger" />
                        <span>{signInError}</span>
                      </motion.div>
                    )}

                    {signInSuccess && (
                      <motion.div variants={itemVariants} className="flex items-center gap-2 rounded-sm border border-status-safe bg-status-safe-quiet p-3 text-xs font-medium text-status-safe">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-status-safe" />
                        <span>{signInSuccess}</span>
                      </motion.div>
                    )}

                    {/* Submit Action Button */}
                    <motion.div variants={itemVariants} className="mt-2">
                      <motion.button
                        type="submit"
                        disabled={signInLoading}
                        whileTap={{ scale: 0.97 }}
                        className="group relative flex min-h-[46px] w-full items-center justify-center gap-2 rounded-sm bg-accent-strong px-5 py-3 text-sm font-bold text-white shadow-md transition-colors duration-150 ease-out hover:bg-accent-hover disabled:opacity-75"
                      >
                        {signInLoading ? (
                          <span className="flex items-center gap-2 font-mono text-xs">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>SIGNING IN...</span>
                          </span>
                        ) : (
                          <>
                            <span>UNLOCK PORTAL</span>
                            <ArrowRight className="h-4 w-4 text-white transition-transform duration-200 group-hover:translate-x-1" />
                          </>
                        )}
                      </motion.button>
                    </motion.div>
                  </form>

                  <motion.p variants={itemVariants} className="mt-5 text-center font-sans text-xs font-medium text-fg-subtle">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={resetPending}
                      className="font-bold text-accent hover:underline cursor-pointer disabled:opacity-60"
                    >
                      {resetPending ? "Sending reset link…" : "Forgot your password?"}
                    </button>
                  </motion.p>

                  <motion.p variants={itemVariants} className="mt-3 text-center font-sans text-xs font-medium text-fg-subtle">
                    Don&apos;t have credentials yet?{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("request")}
                      className="font-bold text-accent hover:underline cursor-pointer"
                    >
                      Request candidate access
                    </button>
                  </motion.p>
                </motion.div>
              )}

              {activeTab === "request" && (
                <motion.div
                  key="tab-request"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.09 }}
                >
                  <motion.div variants={itemVariants} className="mb-6">
                    <h2 className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                      Request Access
                    </h2>
                    <p className="font-sans text-sm text-fg-subtle font-medium mt-1.5">
                      Induction 21 candidates — verify your portal email & Applicant ID.
                    </p>
                  </motion.div>

                  <form onSubmit={handleRequestSubmit} className="flex flex-col gap-4">
                    {/* Portal Email */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label htmlFor="reqEmail" className="font-sans text-xs font-bold uppercase tracking-wider text-fg-muted">
                        Portal Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
                        <input
                          id="reqEmail"
                          type="email"
                          required
                          autoComplete="email"
                          suppressHydrationWarning
                          placeholder="same as induction portal"
                          value={reqEmail}
                          onChange={(e) => setReqEmail(e.target.value)}
                          className="w-full rounded-sm border border-border-strong/90 bg-surface pl-10 pr-4 py-3 font-mono text-sm text-foreground placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                        />
                      </div>
                    </motion.div>

                    {/* Applicant ID */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label htmlFor="reqApplicantId" className="font-sans text-xs font-bold uppercase tracking-wider text-fg-muted flex justify-between">
                        <span>Applicant ID</span>
                        <span className="font-mono text-[10px] text-accent font-bold">e.g. 39244</span>
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
                        <input
                          id="reqApplicantId"
                          type="text"
                          required
                          placeholder="39244"
                          value={reqApplicantId}
                          onChange={(e) => setReqApplicantId(e.target.value)}
                          className="w-full rounded-sm border border-border-strong/90 bg-surface pl-10 pr-4 py-3 font-mono text-sm text-foreground placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                        />
                      </div>
                    </motion.div>

                    {/* Candidate Autocomplete Verification Preview */}
                    {reqMatchedCandidate && (
                      <motion.div
                        variants={itemVariants}
                        className="rounded-md border border-accent/40 bg-accent-quiet p-3.5 text-xs text-foreground"
                      >
                        <div className="flex items-center gap-2 font-bold text-accent">
                          <CheckCircle2 className="h-4 w-4 text-accent" />
                          <span>GAZETTE RECORD MATCHED</span>
                        </div>
                        <p className="font-sans font-bold text-sm text-foreground mt-1">
                          {reqMatchedCandidate.nameFull}
                        </p>
                        <p className="font-mono text-[11px] text-fg-muted">
                          Applicant ID: <strong className="text-accent">{reqMatchedCandidate.applicantId}</strong>
                        </p>
                      </motion.div>
                    )}

                    {/* Message to Admin */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label htmlFor="reqMsg" className="font-sans text-xs font-bold uppercase tracking-wider text-fg-muted">
                        Message to Admin <span className="font-normal text-fg-subtle">(Optional)</span>
                      </label>
                      <textarea
                        id="reqMsg"
                        rows={2}
                        maxLength={600}
                        placeholder="Use this for access issues, complaints, or questions."
                        value={reqMsg}
                        onChange={(e) => setReqMsg(e.target.value)}
                        className="w-full rounded-sm border border-border-strong/90 bg-surface px-3.5 py-2.5 font-sans text-xs text-foreground placeholder:text-fg-subtle focus:border-accent focus:outline-none resize-none"
                      />
                    </motion.div>

                    {/* Feedback */}
                    {reqError && (
                      <motion.div variants={itemVariants} className="flex items-center gap-2 rounded-sm border border-status-danger bg-status-danger-quiet p-3 text-xs font-medium text-status-danger">
                        <AlertCircle className="h-4 w-4 shrink-0 text-status-danger" />
                        <span>{reqError}</span>
                      </motion.div>
                    )}

                    {reqSuccess && (
                      <motion.div variants={itemVariants} className="flex items-center gap-2 rounded-sm border border-status-safe bg-status-safe-quiet p-3 text-xs font-medium text-status-safe">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-status-safe" />
                        <span>{reqSuccess}</span>
                      </motion.div>
                    )}

                    <motion.div variants={itemVariants}>
                      <motion.button
                        type="submit"
                        disabled={reqLoading}
                        whileTap={{ scale: 0.97 }}
                        className="group relative flex min-h-[46px] w-full items-center justify-center gap-2 rounded-sm bg-accent-strong px-5 py-3 text-sm font-bold text-white shadow-md transition-colors duration-150 ease-out hover:bg-accent-hover disabled:opacity-75"
                      >
                        {reqLoading ? (
                          <span className="flex items-center gap-2 font-mono text-xs">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>SUBMITTING REQUEST...</span>
                          </span>
                        ) : (
                          <>
                            <span>SUBMIT ACCESS REQUEST</span>
                            <ArrowRight className="h-4 w-4 text-white transition-transform duration-200 group-hover:translate-x-1" />
                          </>
                        )}
                      </motion.button>
                    </motion.div>
                  </form>
                </motion.div>
              )}

              {activeTab === "proof" && (
                <motion.div
                  key="tab-proof"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.09 }}
                >
                  <motion.div variants={itemVariants} className="mb-6">
                    <h2 className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                      Submit Payment Proof
                    </h2>
                    <p className="font-sans text-sm text-fg-subtle font-medium mt-1.5">
                      Upload a screenshot or photo of your payment transaction for admin review.
                    </p>
                  </motion.div>

                  <form onSubmit={handleProofSubmit} className="flex flex-col gap-4">
                    {/* Email */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label htmlFor="proofEmail" className="font-sans text-xs font-bold uppercase tracking-wider text-fg-muted">
                        Email Used for Access Request
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
                        <input
                          id="proofEmail"
                          type="email"
                          required
                          autoComplete="email"
                          suppressHydrationWarning
                          placeholder="your@email.com"
                          value={proofEmail}
                          onChange={(e) => setProofEmail(e.target.value)}
                          className="w-full rounded-sm border border-border-strong/90 bg-surface pl-10 pr-4 py-3 font-mono text-sm text-foreground placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-all"
                        />
                      </div>
                    </motion.div>

                    {/* Screenshot Upload Drop Area */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label className="font-sans text-xs font-bold uppercase tracking-wider text-fg-muted">
                        Payment Screenshot / Photo
                      </label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer flex flex-col items-center justify-center rounded-md border-2 border-dashed border-border-strong bg-surface-sunken p-5 text-center hover:border-accent hover:bg-accent-quiet/30 transition-all"
                      >
                        <Upload className="h-6 w-6 text-accent mb-1.5" />
                        <p className="font-sans text-xs font-bold text-fg-muted">
                          Click to attach your payment screenshot
                        </p>
                        <p className="font-mono text-[10px] text-fg-subtle mt-0.5">
                          JPG, PNG, WebP or PDF · up to 5 MB · sent as-is
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </div>

                      {/* Image Preview */}
                      {proofImageBase64 && (
                        <div className="mt-2 rounded-md border border-accent/40 bg-brand-midnight-deep p-2 overflow-hidden max-h-48 flex justify-center">
                          <img
                            src={proofImageBase64}
                            alt="Payment Proof Preview"
                            className="object-contain max-h-44 rounded"
                          />
                        </div>
                      )}
                    </motion.div>

                    {/* Message */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label htmlFor="proofMsg" className="font-sans text-xs font-bold uppercase tracking-wider text-fg-muted">
                        Additional Details / Message
                      </label>
                      <textarea
                        id="proofMsg"
                        rows={2}
                        maxLength={600}
                        placeholder="Any details about your payment transaction..."
                        value={proofMsg}
                        onChange={(e) => setProofMsg(e.target.value)}
                        className="w-full rounded-sm border border-border-strong/90 bg-surface px-3.5 py-2.5 font-sans text-xs text-foreground placeholder:text-fg-subtle focus:border-accent focus:outline-none resize-none"
                      />
                    </motion.div>

                    {/* Feedback */}
                    {proofError && (
                      <motion.div variants={itemVariants} className="flex items-center gap-2 rounded-sm border border-status-danger bg-status-danger-quiet p-3 text-xs font-medium text-status-danger">
                        <AlertCircle className="h-4 w-4 shrink-0 text-status-danger" />
                        <span>{proofError}</span>
                      </motion.div>
                    )}

                    {proofSuccess && (
                      <motion.div variants={itemVariants} className="flex items-center gap-2 rounded-sm border border-status-safe bg-status-safe-quiet p-3 text-xs font-medium text-status-safe">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-status-safe" />
                        <span>{proofSuccess}</span>
                      </motion.div>
                    )}

                    <motion.div variants={itemVariants}>
                      <motion.button
                        type="submit"
                        disabled={proofLoading}
                        whileTap={{ scale: 0.97 }}
                        className="group relative flex min-h-[46px] w-full items-center justify-center gap-2 rounded-sm bg-accent-strong px-5 py-3 text-sm font-bold text-white shadow-md transition-colors duration-150 ease-out hover:bg-accent-hover disabled:opacity-75"
                      >
                        {proofLoading ? (
                          <span className="flex items-center gap-2 font-mono text-xs">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>UPLOADING PROOF...</span>
                          </span>
                        ) : (
                          <>
                            <span>SUBMIT PAYMENT PROOF</span>
                            <ArrowRight className="h-4 w-4 text-white transition-transform duration-200 group-hover:translate-x-1" />
                          </>
                        )}
                      </motion.button>
                    </motion.div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Note */}
          <motion.div variants={itemVariants} className="mt-8 border-t border-border pt-5 text-center text-xs font-medium text-fg-subtle space-y-1">
            <p>Access is invite-only. Approved requests receive credentials by email.</p>
            <p className="font-mono text-[11px]">
              <a href="/donate.html" className="font-bold text-accent hover:underline">
                Support MeritNama Infrastructure
              </a>
            </p>
          </motion.div>

        </motion.div>
      </div>

    </div>
  );
}
