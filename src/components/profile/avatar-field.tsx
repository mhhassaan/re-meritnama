"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeAvatar, uploadAvatar } from "@/lib/profile/actions";
import { compressImage } from "@/lib/profile/compress-image";
import { UserIcon } from "@/components/ui/user";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * The profile photo control.
 *
 * Its own form, separate from the profile form around it, because a file
 * upload and a set of text fields fail differently and should not be able to
 * roll each other back — losing three typed fields because an image was too
 * large is the kind of thing that stops people editing anything.
 *
 * The image is downscaled and re-encoded here before it goes anywhere — see
 * `compress-image` for why, the short version being that a phone photo carries
 * the GPS coordinates it was taken at and is several megabytes to render a
 * 72-pixel circle.
 *
 * The checks here are advisory. What actually enforces size and type is the
 * bucket, and the server action re-checks both before it reaches the bucket;
 * this exists so a person gets told before spending an upload on a file that
 * will be refused.
 */
export function AvatarField({
  avatarUrl,
  initial,
}: {
  avatarUrl: string | null;
  initial: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const { ref: icon, handlers } = useActionIcon();

  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [pending, startTransition] = useTransition();

  const busy = preparing || pending;

  async function choose(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Clear immediately, so picking the same file again after an error still
    // fires a change event.
    e.target.value = "";
    if (!file) return;

    setError(null);

    // Checked on the file the person chose, before any work is done on it —
    // a 12 MB TIFF should be refused for what it is, not decoded first.
    if (!TYPES.includes(file.type)) {
      setError("Use a JPEG, PNG or WebP image.");
      return;
    }

    setPreparing(true);
    const { file: prepared } = await compressImage(file);
    setPreparing(false);

    // Checked on the *result*, so a large photo that shrank is accepted and
    // only one that is still too big after downscaling is refused.
    if (prepared.size > MAX_BYTES) {
      setError("That image is still over 2 MB after resizing. Choose another.");
      return;
    }

    const form = new FormData();
    form.set("file", prepared);

    startTransition(async () => {
      const result = await uploadAvatar(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeAvatar();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      {avatarUrl ? (
        // Not `next/image`: the source is a signed URL on the Supabase host
        // that expires in an hour, so there is nothing stable to optimise or
        // cache, and configuring a remote pattern for it would let any object
        // in that bucket be proxied through our own domain.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt="Your profile photo"
          width={72}
          height={72}
          className="h-18 w-18 shrink-0 rounded-full border border-border-strong object-cover"
          style={{ height: 72, width: 72 }}
        />
      ) : (
        <span
          aria-hidden
          className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-accent-quiet font-sans text-2xl font-black uppercase text-accent"
        >
          {initial}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            {...handlers}
            className="flex min-h-[40px] items-center gap-2.5 rounded-sm border border-border-strong px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-fg-muted transition-colors hover:border-accent hover:text-foreground disabled:opacity-60"
          >
            <UserIcon ref={icon} size={ICON_SIZE_SM} aria-hidden />
            {preparing
              ? "Resizing…"
              : pending
                ? "Uploading…"
                : avatarUrl
                  ? "Replace photo"
                  : "Add a photo"}
          </button>

          {avatarUrl && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="font-mono text-[11px] font-bold uppercase tracking-wider text-status-reach transition-opacity hover:opacity-80 disabled:opacity-60"
            >
              Remove
            </button>
          )}

          <input
            ref={input}
            type="file"
            accept={TYPES.join(",")}
            onChange={choose}
            // `hidden` rather than `sr-only`: the labelled control is the
            // button above, and an sr-only file input leaves a second,
            // unlabelled "Choose File" in the accessibility tree.
            hidden
          />
        </div>

        <p className="mt-2 text-xs leading-relaxed text-fg-muted">
          JPEG, PNG or WebP. Resized in your browser before it is sent, which
          also strips the camera and location data a phone photo carries. Stored
          privately — never served at a public address, and it only reaches
          another candidate if you turn discoverability on below.
        </p>

        {error && (
          <p role="alert" className="mt-2 text-xs font-bold text-status-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
