"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { STATUS_SCOPE_COOKIE, scopeById } from "./config";

/**
 * Sets the reader's status scope.
 *
 * The value is validated against the known scopes rather than written through:
 * it lands in a cookie that every portal page reads while rendering, and an
 * unrecognised id would silently fall back on each page instead of failing
 * here where it can be seen.
 *
 * `revalidatePath` on the portal is what makes the original's promise — "changes
 * apply immediately across all tabs" — true for server-rendered pages. Without
 * it the router cache would serve the previous scope's output until it expired.
 */
export async function setStatusScope(id: string): Promise<{ id: string }> {
  const scope = scopeById(id);

  const store = await cookies();
  store.set(STATUS_SCOPE_COOKIE, scope.id, {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 180,
  });

  revalidatePath("/app/portal", "layout");

  return { id: scope.id };
}
