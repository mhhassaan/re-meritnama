"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/** Matches the project's Supabase minimum; kept in one place so it cannot drift. */
const MIN_PASSWORD_LENGTH = 8;

export function UpdatePasswordForm({ email }: { email: string }) {
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setPending(false);
      return;
    }

    setDone(true);
    // Full navigation so the server picks up the refreshed session cookies.
    window.location.assign("/app");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-16 text-foreground">
      <div className="w-full max-w-md">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.38em] text-accent">
          Set Your Password
        </p>
        <h1 className="mt-3 font-sans text-3xl font-black tracking-tight">
          Choose a password
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          For <span className="font-mono text-foreground">{email}</span>. You will
          use this to sign in from now on.
        </p>

        <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="newPassword"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-fg-muted"
            >
              New Password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
              <input
                id="newPassword"
                type={show ? "text" : "password"}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-sm border border-border-strong/90 bg-surface py-3 pl-10 pr-10 font-mono text-sm text-foreground placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg-muted"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirmPassword"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-fg-muted"
            >
              Confirm Password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
              <input
                id="confirmPassword"
                type={show ? "text" : "password"}
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-sm border border-border-strong/90 bg-surface py-3 pl-10 pr-4 font-mono text-sm text-foreground placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-sm border border-status-danger bg-status-danger-quiet p-3 text-xs text-status-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {done && (
            <div className="flex items-start gap-2 rounded-sm border border-status-safe bg-status-safe-quiet p-3 text-xs text-status-safe">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Password set. Opening your portal…</span>
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="group flex min-h-[46px] w-full items-center justify-center gap-2 rounded-sm bg-accent-strong px-5 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-accent-hover disabled:opacity-75"
          >
            <span>{pending ? "SAVING…" : "SET PASSWORD"}</span>
            {!pending && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
