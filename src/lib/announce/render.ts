/**
 * The article body format.
 *
 * Deliberately not Markdown, and deliberately not HTML.
 *
 * Rendering author-supplied HTML would let anything into a page every signed-in
 * candidate reads, and a full Markdown renderer brings raw-HTML passthrough,
 * arbitrary link targets and image embeds with it — all of which are ways to
 * reach off this site from a surface that speaks in its voice. The authors here
 * are staff rather than the public, which lowers the risk without changing the
 * shape of it: a compromised moderator account should not be able to publish a
 * login form.
 *
 * So the format is two things, parsed explicitly:
 *
 *   - a line beginning `## ` is a heading
 *   - everything else is a paragraph, blank lines separating them
 *
 * That is enough for the pieces the original publishes — its two live articles
 * are headed sections of prose and nothing else — and everything not on this
 * list renders as the literal text the author typed, which is the safe failure.
 */

export type Block =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string };

export function parseArticle(body: string): Block[] {
  const blocks: Block[] = [];

  for (const chunk of body.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    const text = chunk.trim();
    if (!text) continue;

    if (text.startsWith("## ")) {
      // A heading is one line. Anything after a newline in the same chunk is
      // its own paragraph rather than being swallowed into the heading.
      const [first, ...rest] = text.split("\n");
      blocks.push({ kind: "heading", text: first.slice(3).trim() });
      const remainder = rest.join("\n").trim();
      if (remainder) blocks.push({ kind: "paragraph", text: remainder });
      continue;
    }

    blocks.push({ kind: "paragraph", text });
  }

  return blocks;
}

/** Words per minute, for the "N min read" estimate an author can override. */
const READING_SPEED = 220;

export function estimateReadMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / READING_SPEED));
}
