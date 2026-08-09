"use client";

/**
 * Supabase client for browser code.
 *
 * Uses the publishable key, which is designed to ship to the browser — every
 * Supabase app exposes it in its own page source. Data is protected by Row
 * Level Security, not by hiding this key. The service_role key must never
 * appear here; see ./admin.ts.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // Prefer the publishable key; fall back to the legacy anon JWT so the app
    // still runs against projects that have not issued one.
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
