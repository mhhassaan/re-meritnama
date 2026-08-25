/**
 * Downscales and re-encodes an image in the browser, before it is uploaded.
 *
 * ## Why, in order of how much each matters
 *
 * **It strips EXIF.** A photo straight off a phone carries the model, the
 * timestamp and, very often, the GPS coordinates where it was taken. Uploading
 * one verbatim would put a candidate's home address into our bucket as a side
 * effect of them choosing a profile picture — data nobody asked for, nobody
 * displays, and nobody would think to look for. A canvas re-encode carries none
 * of it across, because the encoder is given pixels rather than a file.
 *
 * **It makes the feature usable.** An avatar is rendered at 24, 40 and 72 CSS
 * pixels. A 4032×3024 phone photo is 6 MB of data to deliver a 144-pixel
 * circle, and would simply be refused by the 2 MB limit — so without this the
 * control rejects most of the photos people actually have.
 *
 * **The stored bytes are ours, not theirs.** The upload is whatever the
 * browser's encoder produced from decoded pixels, so a file whose declared
 * content type does not match its contents cannot pass through unchanged. That
 * is a useful property and not a security control: this runs in the browser and
 * a caller can post to the server action directly. What actually contains the
 * risk is still the bucket being private, never rendered as HTML, and refusing
 * SVG.
 *
 * ## Orientation
 *
 * `createImageBitmap(file, { imageOrientation: "from-image" })` applies the
 * EXIF orientation tag while decoding. Without it a portrait photo taken on a
 * phone decodes sideways — the tag says "rotate 90°" and dropping the metadata
 * drops the instruction with it, so the correction has to happen before the
 * data goes away.
 *
 * ## Failure is not fatal
 *
 * If anything here throws — an unsupported codec, a decode failure, a browser
 * without `createImageBitmap` — the original file is returned and the existing
 * size and type checks decide. Better a large upload refused with a clear
 * message than a photo silently corrupted on the way in.
 */

/** Longest edge after downscaling. An avatar renders at 72 CSS px at most. */
const MAX_EDGE = 512;

/** WebP quality. Above ~0.85 the file grows for differences invisible at 72px. */
const QUALITY = 0.85;

export type CompressResult = {
  file: File;
  /** True when the returned file is the one that was passed in. */
  unchanged: boolean;
};

export async function compressImage(file: File): Promise<CompressResult> {
  if (typeof createImageBitmap !== "function") return { file, unchanged: true };

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return { file, unchanged: true };
    }

    // A PNG or WebP with transparency would otherwise composite onto black,
    // which turns a cut-out portrait into a silhouette. The avatar is drawn on
    // a light or dark surface depending on theme, so neither is right — white
    // is the conventional and less destructive choice.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await encode(canvas);
    if (!blob) return { file, unchanged: true };

    // The re-encode is kept even when it comes out larger than the original.
    // An early version returned the original whenever it had not shrunk, which
    // is right on bytes and wrong on the thing that matters: a small image can
    // still carry the coordinates it was taken at, and passing it through to
    // save two kilobytes against a two-megabyte limit trades a privacy property
    // for nothing. Stripping is unconditional; size is the secondary benefit.
    //
    // The one thing this costs: an animated WebP loses its animation, since a
    // canvas holds one frame. For a 40-pixel avatar that is an acceptable and
    // arguably desirable outcome.

    const name = file.name.replace(/\.[^.]+$/, "") || "avatar";
    const extension = blob.type === "image/webp" ? "webp" : "jpg";

    return {
      file: new File([blob], `${name}.${extension}`, { type: blob.type }),
      unchanged: false,
    };
  } catch {
    return { file, unchanged: true };
  }
}

/**
 * WebP where it is supported, JPEG otherwise.
 *
 * `toBlob` does not report an unsupported type — it silently falls back to PNG,
 * which for a photograph is several times larger than the JPEG it replaced. So
 * the result's own `type` is checked rather than trusted, and JPEG is tried
 * when it is not what was asked for.
 */
async function encode(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const webp = await toBlob(canvas, "image/webp", QUALITY);
  if (webp?.type === "image/webp") return webp;
  return toBlob(canvas, "image/jpeg", QUALITY);
}

function toBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
