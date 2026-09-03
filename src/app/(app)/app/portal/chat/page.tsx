import type { Metadata } from "next";
import Link from "next/link";
import {
  loadChatMessages,
  loadChatRooms,
  loadPostingRights,
} from "@/lib/community/data";
import { ChatRoomView } from "@/components/community/chat-room";
import { PortalQuoteStrip } from "@/components/portal/quote-strip";
import { Reveal } from "@/components/app/reveal";
import { Bezel, Eyebrow } from "@/components/app/bezel";
import { AlertIcon } from "@/components/icons/koboyo";

export const metadata: Metadata = {
  title: "Chat | Induction Portal | MeritNama",
  description:
    "Live rooms for the cycle that is open now. Every message carries the name of the person who sent it.",
};

/**
 * Live Chat.
 *
 * The original's three rooms, verbatim: General, Announcements, Preference
 * Strategy. It sits in the portal rather than with Discussion because it is
 * about the cycle happening now — the same split the original makes between
 * its portal Chat and its async forum.
 *
 * **Announcements is read-only for candidates.** A room everyone can write to
 * is a discussion; a room labelled "Announcements" that anyone can write to is
 * a way to publish a false announcement during the week people are deciding
 * their preferences. The rule is a `staff_only_write` flag checked inside the
 * insert policy, not a hidden input box.
 */
export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ room?: string }>;
}) {
  const params = await searchParams;

  const [rooms, rights] = await Promise.all([loadChatRooms(), loadPostingRights()]);

  if (rooms.length === 0) {
    return (
      <div>
        <PortalQuoteStrip />
        <div className="mx-auto max-w-[1000px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
          <Eyebrow>Induction Portal</Eyebrow>
          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em]">
            Chat
          </h1>
          <Bezel className="mt-8" innerClassName="flex items-start gap-3 p-5">
            <AlertIcon className="mt-0.5 h-4 w-auto shrink-0 text-status-reach" />
            <p className="text-sm leading-relaxed text-fg-muted">
              <span className="font-bold text-status-reach">
                Verify your identity first.
              </span>{" "}
              The rooms are only readable once your account is verified.{" "}
              <Link href="/app" className="font-bold text-accent underline">
                Start here
              </Link>
              .
            </p>
          </Bezel>
        </div>
      </div>
    );
  }

  const active = rooms.find((r) => r.id === params.room) ?? rooms[0];
  const messages = await loadChatMessages(active.id);

  return (
    <div>
      <PortalQuoteStrip />

      <div className="mx-auto max-w-[1000px] px-4 py-14 sm:px-6 md:py-20 lg:px-8">
        <Reveal>
          <Eyebrow>Induction Portal</Eyebrow>

          <h1 className="mt-6 font-sans text-[2.5rem] font-black leading-[0.95] tracking-[-0.03em] sm:text-6xl text-balance">
            While the cycle{" "}
            <span className="text-accent">is still moving</span>
          </h1>

          <p className="mt-7 max-w-2xl text-[15px] leading-relaxed text-fg-muted">
            Live rooms for the induction that is open now. Fast, and gone by next
            week — for something worth finding again, write it in{" "}
            <Link href="/app/discussion" className="font-bold text-accent underline">
              Discussion
            </Link>
            .
          </p>
        </Reveal>

        <div className="mt-10 flex flex-wrap gap-2">
          {rooms.map((room) => (
            <Link
              key={room.id}
              // Switching room must not throw the reader to the top of the
              // page — the room they are opening is below the fold.
              scroll={false}
              href={`/app/portal/chat?room=${room.id}`}
              className={`rounded-sm border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                active.id === room.id
                  ? "border-accent bg-accent-quiet font-bold text-accent"
                  : "border-border-strong text-fg-muted hover:border-accent hover:text-foreground"
              }`}
            >
              {room.label}
              {room.staffOnlyWrite && (
                <span className="ml-1.5 opacity-60">read-only</span>
              )}
            </Link>
          ))}
        </div>

        <div className="mt-4">
          {/* Keyed on the room so switching rooms remounts rather than
              reconciling: a live socket and a scroll position both belong to
              one room, and carrying either across is worse than rebuilding. */}
          <ChatRoomView
            key={active.id}
            room={active}
            initial={messages}
            rights={rights}
          />
        </div>

        <p className="mt-8 flex items-start gap-2.5 border-t border-border pt-6 text-xs leading-relaxed text-fg-subtle">
          <AlertIcon className="mt-px h-4 w-auto shrink-0 text-status-reach" />
          <span>
            <span className="font-bold text-status-reach">
              Everything here carries your name.
            </span>{" "}
            Messages cannot be edited once sent — a live room where lines change
            after they are read is a way to rewrite a conversation other people
            have already acted on. You can withdraw your own, and staff can
            remove anything; either way it stops being visible to everyone else.
            Never post anyone’s CNIC, phone number or address, and treat
            anything said here about marks or seats as a rumour until the gazette
            says it.
          </span>
        </p>
      </div>
    </div>
  );
}
