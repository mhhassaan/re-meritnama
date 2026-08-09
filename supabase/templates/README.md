# Email templates

Supabase stores email templates in its dashboard, not in this repository, so
these files are the source of truth for what *should* be there. Changing a file
here changes nothing until it is pasted in.

**Authentication → Emails → Templates**

| Template | File | Link `type` | In use? |
| :-- | :-- | :-- | :-- |
| Invite user | `invite.html` | `invite` | **yes** — the main route in |
| Reset password | `recovery.html` | `recovery` | **yes** — also used by the staff "resend link" action |
| Confirm signup | `confirm-signup.html` | `signup` | no — access is invite-only |
| Magic Link | `magic-link.html` | `magiclink` | no — passwordless not enabled |
| Change Email Address | `email-change.html` | `email_change` | not yet built in the app |
| Reauthentication | `reauthentication.html` | *(none — typed code)* | not yet built in the app |

The unused ones are still written out rather than left at Supabase's defaults:
enabling a feature later would otherwise silently fall back to the default
template, whose implicit-flow link the server-side callback cannot read. The
failure would look like "sign-in is broken" with no obvious cause.

**Reauthentication is the exception to every rule below** — it carries
`{{ .Token }}`, a short code the user types, and has no link at all.

### Keep "Secure email change" enabled

Under Authentication → Providers → Email. It makes an address change require
confirmation from **both** the old and new addresses.

This matters more here than in most products: the address on a candidate record
is what proves identity, since every credential is delivered there. With a single
confirmation, anyone with momentary access to a signed-in session could move the
account to an address they control and permanently own that candidate's data.

## Why the link format matters

The default `{{ .ConfirmationURL }}` uses the implicit flow: it sends the user to
Supabase's own `/verify` endpoint, which redirects back with the session in the
**URL fragment**. Fragments are never transmitted to the server, so
`src/app/auth/callback/route.ts` — a server route — sees an empty request and
the session is lost.

This is not a workaround; it is the documented requirement for server-side auth,
and it is the better flow: the token is verified by our server and the session is
set as an HTTP-only cookie instead of access tokens passing through the address
bar.

## Why the content matters

Observed in testing: the reset email reached the inbox while the invite went to
**spam**. Same sender, same project.

The invite is the only route a new candidate has into the platform, and identity
in this product rests on that email arriving. A message that lands in spam is
indistinguishable, to the candidate, from the platform being broken.

Contributing factors, and what these templates do about them:

| Factor | Handling |
| :-- | :-- |
| One button, no context — structurally identical to phishing | Names the candidate, quotes applicant id and induction, explains what MeritNama is and why they received it |
| Hidden destination | The full URL is also shown as text |
| No reassurance | States the link is single-use, and that MeritNama never asks for passwords, CNIC or payment by email |
| No unsubscribe/context footer | Footer explains why they received it and what to do if it was not them |

What these templates **cannot** fix:

- **Links pointing at `localhost`** — no resolvable domain for a filter to check.
  Resolves itself once `NEXT_PUBLIC_SITE_URL` and the Supabase Site URL point at
  a real domain.
- **Shared sender reputation** — `onboarding@resend.dev` is used by every Resend
  user testing their setup.
- **No SPF, DKIM or DMARC for MeritNama** — nothing proves the mail is genuinely
  from the platform. This needs DNS records on the MeritNama domain and is the
  single biggest factor. **Blocked on the domain owner.**

## Constraints when editing

- Gmail and Outlook strip `<style>` blocks. Everything must be inline styles on
  table-based layout.
- Never include a password, PIN or any credential in the body. The original site
  emailed PINs in plain text.
- Keep the visible URL identical to the button's `href`. A mismatch is a phishing
  signal and will be treated as one.
