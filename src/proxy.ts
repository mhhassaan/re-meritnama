import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js 16 renamed Middleware to Proxy; the file convention is `src/proxy.ts`
 * with a named `proxy` export.
 *
 * Its only real job here is refreshing the Supabase session so Server
 * Components see a live token. The redirect below is an optimistic
 * convenience — it sends a signed-out visitor to /auth rather than rendering a
 * shell that will fail. It is NOT the access control: Proxy runs before the
 * route and can be bypassed, so enforcement lives in RLS and in a getUser()
 * check inside each protected layout.
 */
const PROTECTED_PREFIXES = ["/app", "/admin"];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !user) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/auth";
    // Preserve the destination so sign-in can return the user to it.
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  // Skip static assets and image files: running the session refresh on every
  // icon request wastes an auth round trip per asset.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)",
  ],
};
