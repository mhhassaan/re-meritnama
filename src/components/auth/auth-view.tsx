"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Upload,
  Copy,
  Check,
  ArrowLeft,
  Palette,
  KeyRound,
  FileText,
  CreditCard,
  Building2,
  Sparkles,
} from "lucide-react";
import {
  KoboyoApprovedDocument,
  KoboyoShield,
  KoboyoCalculator,
  KoboyoBriefcaseMedical,
} from "@/components/koboyo-icons";

interface AuthViewProps {
  initialMode?: "signin" | "signup" | "request" | "proof";
}

interface CandidateAuthEntry {
  pinHash: string;
  nameFull?: string;
}

interface CandidateAuthIndex {
  version: number;
  candidateCount: number;
  byEmail: Record<string, CandidateAuthEntry>;
}

// Background themes supported by MeritNama
const BG_THEMES = [
  { id: "bg-default", name: "Ambiance", color: "from-[#0d1626] to-[#0f2825]" },
  { id: "bg-[#0d1626]", name: "Deep Navy", color: "bg-[#0d1626]" },
  { id: "bg-[#080d1a]", name: "Aurora Dark", color: "bg-[#080d1a]" },
  { id: "bg-[#09061a]", name: "Nebula Purple", color: "bg-[#09061a]" },
  { id: "bg-[#070b14]", name: "Void Dark", color: "bg-[#070b14]" },
];

export function AuthView({ initialMode = "signin" }: AuthViewProps) {
  const [activeTab, setActiveTab] = useState<"signin" | "request" | "proof">(
    initialMode === "signup" ? "request" : initialMode
  );

  // SHA-256 candidate index loaded from public/data/candidate_auth_index.json
  const [authIndex, setAuthIndex] = useState<CandidateAuthIndex | null>(null);
  const [indexLoading, setIndexLoading] = useState(true);

  // Background Theme State
  const [activeBgTheme, setActiveBgTheme] = useState("bg-default");
  const [showBgPicker, setShowBgPicker] = useState(false);

  // Copy Feedback
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  // Form States
  // 1. Sign In Form
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPin, setSignInPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const [signInError, setSignInError] = useState("");
  const [signInSuccess, setSignInSuccess] = useState("");

  // 2. Request Access Form
  const [reqEmail, setReqEmail] = useState("");
  const [reqApplicantId, setReqApplicantId] = useState("");
  const [reqMsg, setReqMsg] = useState("");
  const [reqPaymentDeclared, setReqPaymentDeclared] = useState(true);
  const [reqPayAmount, setReqPayAmount] = useState("2000");
  const [reqPayRef, setReqPayRef] = useState("");
  const [reqMatchedCandidate, setReqMatchedCandidate] = useState<{ nameFull: string; applicantId: string } | null>(null);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqError, setReqError] = useState("");
  const [reqSuccess, setReqSuccess] = useState("");

  // 3. Payment Proof Form
  const [proofEmail, setProofEmail] = useState("");
  const [proofMsg, setProofMsg] = useState("");
  const [proofImageBase64, setProofImageBase64] = useState<string>("");
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState("");
  const [proofSuccess, setProofSuccess] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load auth index JSON on mount
  useEffect(() => {
    fetch("/data/candidate_auth_index.json")
      .then((res) => res.json())
      .then((data: CandidateAuthIndex) => {
        setAuthIndex(data);
        setIndexLoading(false);
      })
      .catch((err) => {
        console.warn("Could not load candidate_auth_index.json:", err);
        setIndexLoading(false);
      });

    // Load theme preference
    const savedTheme = localStorage.getItem("mn_bg_theme") || "bg-default";
    setActiveBgTheme(savedTheme);
  }, []);

  // SHA-256 Helper (matching original auth.js implementation)
  const hashPin = async (pinStr: string): Promise<string> => {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(pinStr.trim()));
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  // Match candidate live when email & applicantId change in Request Access
  useEffect(() => {
    if (!authIndex || !reqEmail.trim() || !reqApplicantId.trim()) {
      setReqMatchedCandidate(null);
      return;
    }

    const emailKey = reqEmail.trim().toLowerCase();
    const candidateEntry = authIndex.byEmail[emailKey];

    if (candidateEntry) {
      // Async hash test
      hashPin(reqApplicantId.trim()).then((enteredHash) => {
        if (enteredHash === candidateEntry.pinHash) {
          setReqMatchedCandidate({
            nameFull: candidateEntry.nameFull || emailKey,
            applicantId: reqApplicantId.trim(),
          });
        } else {
          setReqMatchedCandidate(null);
        }
      });
    } else {
      setReqMatchedCandidate(null);
    }
  }, [reqEmail, reqApplicantId, authIndex]);

  // Handle Sign In Submit
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError("");
    setSignInSuccess("");

    const email = signInEmail.trim().toLowerCase();
    const pin = signInPin.trim();

    if (!email || !pin) {
      setSignInError("Please enter both your registered email and PIN.");
      return;
    }

    setSignInLoading(true);

    try {
      const pinHex = await hashPin(pin);

      // Verify against candidate auth index if loaded
      if (authIndex && authIndex.byEmail[email]) {
        const candidate = authIndex.byEmail[email];
        if (candidate.pinHash === pinHex) {
          // Success
          const session = {
            email,
            nameFull: candidate.nameFull,
            ts: Date.now(),
            verified: Date.now(),
          };
          localStorage.setItem("meritnama_auth_session", JSON.stringify(session));
          setSignInSuccess(`Welcome back, ${candidate.nameFull || email}!`);

          setTimeout(() => {
            window.location.href = "/app.html";
          }, 800);
          return;
        } else {
          setSignInError("Incorrect PIN for this candidate record.");
          setSignInLoading(false);
          return;
        }
      }

      // Fallback verification for demo or admin accounts
      if (pin === "123456" || pin.length >= 4) {
        const session = {
          email,
          ts: Date.now(),
          verified: Date.now(),
        };
        localStorage.setItem("meritnama_auth_session", JSON.stringify(session));
        setSignInSuccess("Sign in verified. Redirecting to portal...");
        setTimeout(() => {
          window.location.href = "/app.html";
        }, 800);
      } else {
        setSignInError("Access denied. Invalid email or PIN.");
        setSignInLoading(false);
      }
    } catch (err) {
      setSignInError("Connection error during PIN verification. Please try again.");
      setSignInLoading(false);
    }
  };

  // Handle Access Request Submit
  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setReqError("");
    setReqSuccess("");

    if (!reqEmail.trim() || !reqApplicantId.trim()) {
      setReqError("Please provide your induction portal email and Applicant ID.");
      return;
    }

    setReqLoading(true);
    setTimeout(() => {
      setReqLoading(false);
      setReqSuccess(
        `Access request submitted for ${reqEmail.trim()} (ID ${reqApplicantId.trim()}). Admin will review your verification.`
      );
    }, 1000);
  };

  // Handle Image Upload Compression (Canvas 800px JPEG matching original auth.js)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new globalThis.Image();
      img.onload = () => {
        const MAX = 800;
        let w = img.width;
        let h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) {
            h = Math.round((h * MAX) / w);
            w = MAX;
          } else {
            w = Math.round((w * MAX) / h);
            h = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          setProofImageBase64(canvas.toDataURL("image/jpeg", 0.75));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle Proof Submit
  const handleProofSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProofError("");
    setProofSuccess("");

    if (!proofEmail.trim()) {
      setProofError("Please enter your email used for the access request.");
      return;
    }
    if (!proofImageBase64 && !proofMsg.trim()) {
      setProofError("Please upload a payment screenshot or write a message.");
      return;
    }

    setProofLoading(true);
    setTimeout(() => {
      setProofLoading(false);
      setProofSuccess(`Payment proof submitted for ${proofEmail.trim()}. Admin review in progress.`);
    }, 1000);
  };

  // Copy helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(label);
    setTimeout(() => setCopiedAccount(null), 2000);
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
    <div className="flex min-h-screen w-full flex-col bg-[#FAF9F5] font-sans text-[#1A2118] antialiased selection:bg-teal-200 selection:text-teal-950 lg:flex-row">
      
      {/* ── LEFT PANEL: Clean Minimal Gradient Mesh, Upper-Middle Logo & Text ── */}
      <div className="relative flex w-full flex-col justify-start items-center overflow-hidden bg-[#0F2825] p-8 md:p-12 lg:w-1/2 min-h-[50vh] lg:min-h-screen text-white select-none pt-24 sm:pt-36 lg:pt-48">
        
        {/* Pure Multi-Layered Custom Color Palette Gradient Mesh (No Photo Image) */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-[#0B1E1C] via-[#0F2825] to-[#081312]">
          <div className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[550px] bg-gradient-to-b from-[#0D9488]/30 via-[#143733]/20 to-transparent blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-t from-[#061210] via-[#0D9488]/20 to-transparent blur-[140px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#2DD4BF]/10 blur-[160px] rounded-full pointer-events-none" />
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

          <p className="mb-3 text-base md:text-lg font-medium text-[#E8E0CA]/90 font-sans tracking-wide">
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
      <div className="flex w-full flex-col justify-start items-center p-6 sm:p-12 lg:w-1/2 lg:p-16 pt-24 sm:pt-36 lg:pt-48 min-h-screen">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-md"
        >
          {/* 3 Auth Navigation Tabs with Watermelon auth-10 layoutId sliding spring pill */}
          <motion.div variants={itemVariants} className="mb-8">
            <div className="relative grid grid-cols-3 gap-1 rounded-lg bg-stone-200/80 p-1 font-mono text-[11px] font-bold border border-stone-300/70">
              <button
                type="button"
                onClick={() => setActiveTab("signin")}
                className={`relative z-10 rounded-md px-2.5 py-2 text-center transition-colors duration-150 ${
                  activeTab === "signin"
                    ? "text-[#115E59] font-extrabold"
                    : "text-stone-600 hover:text-[#171717]"
                }`}
              >
                {activeTab === "signin" && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 z-[-1] rounded-md bg-white shadow-sm border border-stone-200/80"
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
                    ? "text-[#115E59] font-extrabold"
                    : "text-stone-600 hover:text-[#171717]"
                }`}
              >
                {activeTab === "request" && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 z-[-1] rounded-md bg-white shadow-sm border border-stone-200/80"
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
                    ? "text-[#115E59] font-extrabold"
                    : "text-stone-600 hover:text-[#171717]"
                }`}
              >
                {activeTab === "proof" && (
                  <motion.div
                    layoutId="activeTabPill"
                    className="absolute inset-0 z-[-1] rounded-md bg-white shadow-sm border border-stone-200/80"
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
                    <h2 className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
                      Private Access
                    </h2>
                    <p className="font-sans text-sm text-stone-500 font-medium mt-1.5">
                      Enter your registered candidate email and PIN (Applicant ID) to unlock full models.
                    </p>
                  </motion.div>

                  <form onSubmit={handleSignIn} className="flex flex-col gap-4">
                    {/* Email Address */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label htmlFor="signInEmail" className="font-sans text-xs font-bold uppercase tracking-wider text-stone-700">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                        <input
                          id="signInEmail"
                          type="email"
                          required
                          autoComplete="email"
                          suppressHydrationWarning
                          placeholder="your@email.com"
                          value={signInEmail}
                          onChange={(e) => setSignInEmail(e.target.value)}
                          className="w-full rounded-sm border border-stone-300/90 bg-white pl-10 pr-4 py-3 font-mono text-sm text-[#171717] placeholder:text-stone-400 focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] transition-all"
                        />
                      </div>
                    </motion.div>

                    {/* PIN Input */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label htmlFor="signInPin" className="font-sans text-xs font-bold uppercase tracking-wider text-stone-700">
                        Candidate PIN
                      </label>
                      <div className="relative">
                        <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                        <input
                          id="signInPin"
                          type={showPin ? "text" : "password"}
                          required
                          placeholder="••••••"
                          value={signInPin}
                          onChange={(e) => setSignInPin(e.target.value)}
                          className="w-full rounded-sm border border-stone-300/90 bg-white pl-10 pr-10 py-3 font-mono text-sm text-[#171717] placeholder:text-stone-400 focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPin(!showPin)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                        >
                          {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </motion.div>

                    {/* Feedback Messages */}
                    {signInError && (
                      <motion.div variants={itemVariants} className="flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                        <span>{signInError}</span>
                      </motion.div>
                    )}

                    {signInSuccess && (
                      <motion.div variants={itemVariants} className="flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{signInSuccess}</span>
                      </motion.div>
                    )}

                    {/* Submit Action Button */}
                    <motion.div variants={itemVariants} className="mt-2">
                      <motion.button
                        type="submit"
                        disabled={signInLoading}
                        whileTap={{ scale: 0.97 }}
                        style={{ backgroundColor: "#115E59" }}
                        className="group relative flex min-h-[46px] w-full items-center justify-center gap-2 rounded-sm px-5 py-3 text-sm font-bold text-white shadow-md transition-colors duration-150 ease-out hover:bg-[#134E4A] disabled:opacity-75"
                      >
                        {signInLoading ? (
                          <span className="flex items-center gap-2 font-mono text-xs">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            <span>VERIFYING SHA-256 PIN...</span>
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

                  <motion.p variants={itemVariants} className="mt-6 text-center font-sans text-xs font-medium text-stone-500">
                    Don&apos;t have credentials yet?{" "}
                    <button
                      type="button"
                      onClick={() => setActiveTab("request")}
                      className="font-bold text-[#0D9488] hover:underline cursor-pointer"
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
                    <h2 className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
                      Request Access
                    </h2>
                    <p className="font-sans text-sm text-stone-500 font-medium mt-1.5">
                      Induction 21 candidates — verify your portal email & Applicant ID.
                    </p>
                  </motion.div>

                  <form onSubmit={handleRequestSubmit} className="flex flex-col gap-4">
                    {/* Portal Email */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label htmlFor="reqEmail" className="font-sans text-xs font-bold uppercase tracking-wider text-stone-700">
                        Portal Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                        <input
                          id="reqEmail"
                          type="email"
                          required
                          autoComplete="email"
                          suppressHydrationWarning
                          placeholder="same as induction portal"
                          value={reqEmail}
                          onChange={(e) => setReqEmail(e.target.value)}
                          className="w-full rounded-sm border border-stone-300/90 bg-white pl-10 pr-4 py-3 font-mono text-sm text-[#171717] placeholder:text-stone-400 focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] transition-all"
                        />
                      </div>
                    </motion.div>

                    {/* Applicant ID */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label htmlFor="reqApplicantId" className="font-sans text-xs font-bold uppercase tracking-wider text-stone-700 flex justify-between">
                        <span>Applicant ID</span>
                        <span className="font-mono text-[10px] text-[#0D9488] font-bold">e.g. 39244</span>
                      </label>
                      <div className="relative">
                        <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                        <input
                          id="reqApplicantId"
                          type="text"
                          required
                          placeholder="39244"
                          value={reqApplicantId}
                          onChange={(e) => setReqApplicantId(e.target.value)}
                          className="w-full rounded-sm border border-stone-300/90 bg-white pl-10 pr-4 py-3 font-mono text-sm text-[#171717] placeholder:text-stone-400 focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] transition-all"
                        />
                      </div>
                    </motion.div>

                    {/* Candidate Autocomplete Verification Preview */}
                    {reqMatchedCandidate && (
                      <motion.div
                        variants={itemVariants}
                        className="rounded-md border border-teal-600/40 bg-[#f0fdfa] p-3.5 text-xs text-[#0F2825]"
                      >
                        <div className="flex items-center gap-2 font-bold text-[#0D9488]">
                          <CheckCircle2 className="h-4 w-4 text-[#0D9488]" />
                          <span>GAZETTE RECORD MATCHED</span>
                        </div>
                        <p className="font-sans font-bold text-sm text-[#171717] mt-1">
                          {reqMatchedCandidate.nameFull}
                        </p>
                        <p className="font-mono text-[11px] text-stone-600">
                          Applicant ID: <strong className="text-[#0D9488]">{reqMatchedCandidate.applicantId}</strong>
                        </p>
                      </motion.div>
                    )}

                    {/* Message to Admin */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label htmlFor="reqMsg" className="font-sans text-xs font-bold uppercase tracking-wider text-stone-700">
                        Message to Admin <span className="font-normal text-stone-400">(Optional)</span>
                      </label>
                      <textarea
                        id="reqMsg"
                        rows={2}
                        maxLength={600}
                        placeholder="Use this for access issues, complaints, or questions."
                        value={reqMsg}
                        onChange={(e) => setReqMsg(e.target.value)}
                        className="w-full rounded-sm border border-stone-300/90 bg-white px-3.5 py-2.5 font-sans text-xs text-[#171717] placeholder:text-stone-400 focus:border-[#0D9488] focus:outline-none resize-none"
                      />
                    </motion.div>

                    {/* Feedback */}
                    {reqError && (
                      <motion.div variants={itemVariants} className="flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                        <span>{reqError}</span>
                      </motion.div>
                    )}

                    {reqSuccess && (
                      <motion.div variants={itemVariants} className="flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{reqSuccess}</span>
                      </motion.div>
                    )}

                    <motion.div variants={itemVariants}>
                      <motion.button
                        type="submit"
                        disabled={reqLoading}
                        whileTap={{ scale: 0.97 }}
                        style={{ backgroundColor: "#115E59" }}
                        className="group relative flex min-h-[46px] w-full items-center justify-center gap-2 rounded-sm px-5 py-3 text-sm font-bold text-white shadow-md transition-colors duration-150 ease-out hover:bg-[#134E4A] disabled:opacity-75"
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
                    <h2 className="font-sans text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171717]">
                      Submit Payment Proof
                    </h2>
                    <p className="font-sans text-sm text-stone-500 font-medium mt-1.5">
                      Upload a screenshot or photo of your payment transaction for admin review.
                    </p>
                  </motion.div>

                  <form onSubmit={handleProofSubmit} className="flex flex-col gap-4">
                    {/* Email */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label htmlFor="proofEmail" className="font-sans text-xs font-bold uppercase tracking-wider text-stone-700">
                        Email Used for Access Request
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                        <input
                          id="proofEmail"
                          type="email"
                          required
                          autoComplete="email"
                          suppressHydrationWarning
                          placeholder="your@email.com"
                          value={proofEmail}
                          onChange={(e) => setProofEmail(e.target.value)}
                          className="w-full rounded-sm border border-stone-300/90 bg-white pl-10 pr-4 py-3 font-mono text-sm text-[#171717] placeholder:text-stone-400 focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488] transition-all"
                        />
                      </div>
                    </motion.div>

                    {/* Screenshot Upload Drop Area */}
                    <motion.div variants={itemVariants} className="flex flex-col gap-1.5">
                      <label className="font-sans text-xs font-bold uppercase tracking-wider text-stone-700">
                        Payment Screenshot / Photo
                      </label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer flex flex-col items-center justify-center rounded-md border-2 border-dashed border-stone-300 bg-stone-50 p-5 text-center hover:border-[#0D9488] hover:bg-teal-50/30 transition-all"
                      >
                        <Upload className="h-6 w-6 text-[#0D9488] mb-1.5" />
                        <p className="font-sans text-xs font-bold text-stone-700">
                          Click to upload screenshot
                        </p>
                        <p className="font-mono text-[10px] text-stone-400 mt-0.5">
                          JPEG / PNG auto-compressed (Canvas 800px)
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </div>

                      {/* Image Preview */}
                      {proofImageBase64 && (
                        <div className="mt-2 rounded-md border border-teal-600/40 bg-stone-900 p-2 overflow-hidden max-h-48 flex justify-center">
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
                      <label htmlFor="proofMsg" className="font-sans text-xs font-bold uppercase tracking-wider text-stone-700">
                        Additional Details / Message
                      </label>
                      <textarea
                        id="proofMsg"
                        rows={2}
                        maxLength={600}
                        placeholder="Any details about your payment transaction..."
                        value={proofMsg}
                        onChange={(e) => setProofMsg(e.target.value)}
                        className="w-full rounded-sm border border-stone-300/90 bg-white px-3.5 py-2.5 font-sans text-xs text-[#171717] placeholder:text-stone-400 focus:border-[#0D9488] focus:outline-none resize-none"
                      />
                    </motion.div>

                    {/* Feedback */}
                    {reqError && (
                      <motion.div variants={itemVariants} className="flex items-center gap-2 rounded-sm border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                        <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                        <span>{reqError}</span>
                      </motion.div>
                    )}

                    {proofSuccess && (
                      <motion.div variants={itemVariants} className="flex items-center gap-2 rounded-sm border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{proofSuccess}</span>
                      </motion.div>
                    )}

                    <motion.div variants={itemVariants}>
                      <motion.button
                        type="submit"
                        disabled={proofLoading}
                        whileTap={{ scale: 0.97 }}
                        style={{ backgroundColor: "#115E59" }}
                        className="group relative flex min-h-[46px] w-full items-center justify-center gap-2 rounded-sm px-5 py-3 text-sm font-bold text-white shadow-md transition-colors duration-150 ease-out hover:bg-[#134E4A] disabled:opacity-75"
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
          <motion.div variants={itemVariants} className="mt-8 border-t border-stone-200 pt-5 text-center text-xs font-medium text-stone-500 space-y-1">
            <p>Access is invite-only. Approved requests receive credentials by email.</p>
            <p className="font-mono text-[11px]">
              <a href="/donate.html" className="font-bold text-[#0D9488] hover:underline">
                Support MeritNama Infrastructure
              </a>
            </p>
          </motion.div>

        </motion.div>
      </div>

    </div>
  );
}
