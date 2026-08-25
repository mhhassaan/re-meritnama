"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendChatMessage } from "@/lib/community/actions";
import { LIMITS } from "@/lib/community/terms";
import type {
  ChatMessage,
  ChatRoom,
  PostingRights,
} from "@/lib/community/data";
import { Bezel } from "@/components/app/bezel";
import { ReportButton } from "@/components/community/report-button";
import { AlertIcon } from "@/components/icons/koboyo";
import { Message01Icon } from "@/components/ui/message-01";
import { ICON_SIZE_SM, useActionIcon } from "@/components/app/action-icon";

/**
 * A live room.
 *
 * ## Realtime respects RLS, which is the whole reason it is safe to use here
 *
 * The subscription delivers exactly the rows `chat_messages_select` would have
 * returned for this reader, so a hidden message never arrives in somebody
 * else's socket. That is a property of Supabase Realtime running the policy on
 * the replicated row, not of the filter below — the `room_id` filter is there
 * to avoid delivering traffic from rooms nobody is looking at.
 *
 * Which is also why `realtime.setAuth` has to be called before subscribing.
 * The socket authenticates separately from the REST client, and a socket with
 * no token is an anonymous reader — the policy then matches nothing and the
 * subscription silently delivers zero rows forever. It fails as silence rather
 * than as an error, which is exactly how it was missed the first time.
 *
 * ## Sending goes through a server action, not this client
 *
 * The browser client could insert directly and the policies would hold either
 * way. It goes through the action so that one place turns a policy refusal into
 * a sentence — "Announcements is read-only", "you are sending too fast" —
 * rather than surfacing Postgres error text in a chat window.
 *
 * ## Your own message never waits on the socket
 *
 * The action returns the stored row and it is appended here. An earlier version
 * returned only an id and relied on the subscription to deliver the sender
 * their own message — so with the socket down, a person watched their message
 * disappear while it was in fact saved, and sent it again. Realtime carries
 * other people's messages; yours is already in hand.
 *
 * ## Scrolling
 *
 * Pinned to the bottom only when the reader is already near it. Yanking someone
 * back down while they are reading history is the single most irritating thing
 * a chat window can do, and it happens on every incoming message.
 */
export function ChatRoomView({
  room,
  initial,
  rights,
}: {
  room: ChatRoom;
  initial: ChatMessage[];
  rights: PostingRights;
}) {
  const [messages, setMessages] = useState(initial);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { ref: icon, handlers } = useActionIcon();

  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);

  // Room changes are a prop change on a mounted component, so the accumulated
  // messages have to be dropped or the new room opens showing the old one's.
  const seen = useRef(room.id);
  if (seen.current !== room.id) {
    seen.current = room.id;
    setMessages(initial);
    pinned.current = true;
  }

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // The websocket carries its own credential. Without this the subscription
      // connects as an anonymous reader, `chat_messages_select` matches nothing,
      // and no message ever arrives — with no error anywhere.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token)
        supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;

      channel = supabase
        .channel(`chat:${room.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `room_id=eq.${room.id}`,
          },
          (payload) => {
            const row = payload.new as {
              id: number;
              room_id: string;
              body: string;
              created_at: string;
              author_id: string;
              author_name: string;
              hidden_at: string | null;
              hidden_reason: string | null;
            };

            setMessages((prev) => {
              // Keyed rather than appended blindly: the sender also receives its
              // own insert over the socket, and the action has already refreshed
              // the list, so a blind append shows every message twice.
              if (prev.some((m) => m.id === row.id)) return prev;
              return [
                ...prev,
                {
                  id: row.id,
                  roomId: row.room_id,
                  body: row.body,
                  createdAt: row.created_at,
                  author: {
                    id: row.author_id,
                    name: row.author_name,
                    isMe: row.author_id === rights.userId,
                  },
                  moderation: {
                    hidden: Boolean(row.hidden_at),
                    reason: row.hidden_reason,
                  },
                },
              ];
            });
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [room.id, rights.userId]);

  useEffect(() => {
    if (!pinned.current) return;
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    // 80px of slack: a reader one line up from the bottom still counts as
    // following along.
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setError(null);

    startTransition(async () => {
      const result = await sendChatMessage({ roomId: room.id, body: text });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const row = result.message;
      setMessages((prev) =>
        // Keyed, because the socket delivers this same row a moment later.
        prev.some((m) => m.id === row.id)
          ? prev
          : [
              ...prev,
              {
                id: row.id,
                roomId: row.room_id,
                body: row.body,
                createdAt: row.created_at,
                author: {
                  id: row.author_id,
                  name: row.author_name,
                  isMe: true,
                },
                moderation: { hidden: false, reason: null },
              },
            ],
      );

      setBody("");
      pinned.current = true;
    });
  }

  const readOnly = room.staffOnlyWrite && !rights.isStaff;

  return (
    <Bezel innerClassName="flex h-[min(70vh,640px)] flex-col">
      <div className="border-b border-border px-5 py-3">
        <p className="font-sans text-sm font-bold text-foreground">
          {room.label}
        </p>
        {room.description && (
          <p className="mt-0.5 text-xs text-fg-muted">{room.description}</p>
        )}
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-5 py-4"
      >
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-fg-muted">
            Nothing here yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => (
              <div key={message.id} className="group flex items-start gap-2.5">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-quiet font-sans text-[10px] font-black uppercase text-accent"
                >
                  {message.author.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 font-mono text-[10px] text-fg-subtle">
                    <span className="font-bold text-fg-muted">
                      {message.author.name}
                    </span>
                    {message.author.isMe && (
                      <span className="uppercase tracking-wider text-hope">
                        you
                      </span>
                    )}
                    <span>{timeOf(message.createdAt)}</span>
                    {!message.author.isMe && (
                      <span className="opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <ReportButton target="message" targetId={message.id} />
                      </span>
                    )}
                  </p>
                  <p
                    className={`mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed ${
                      message.moderation.hidden
                        ? "text-fg-subtle line-through"
                        : "text-foreground"
                    }`}
                  >
                    {message.body}
                  </p>
                  {message.moderation.hidden && (
                    <p className="mt-0.5 font-mono text-[10px] text-status-reach">
                      {message.moderation.reason === "author"
                        ? "withdrawn — only you and staff see this"
                        : "removed by staff — only you and staff see this"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        {readOnly ? (
          <p className="flex items-center gap-2 px-2 py-2 text-xs text-fg-muted">
            <AlertIcon className="h-3.5 w-auto shrink-0 text-status-reach" />
            Announcements is read-only. Post in General instead.
          </p>
        ) : !rights.canPost ? (
          <p className="flex items-center gap-2 px-2 py-2 text-xs text-fg-muted">
            <AlertIcon className="h-3.5 w-auto shrink-0 text-status-reach" />
            {rights.blockedBy === "no-display-name"
              ? "Set a display name on your profile before posting."
              : "Verify your account before posting."}
          </p>
        ) : (
          <form onSubmit={send} className="flex items-end gap-2">
            <label htmlFor="chat-body" className="sr-only">
              Message
            </label>
            <textarea
              id="chat-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter breaks the line — the convention
                // every chat window uses, and getting it backwards makes a
                // room feel broken.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(e);
                }
              }}
              maxLength={LIMITS.chatBody}
              rows={1}
              className="max-h-32 min-h-[42px] flex-1 resize-none rounded-sm border border-border-strong bg-surface-sunken px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent"
              placeholder={`Message ${room.label}…`}
            />
            <button
              type="submit"
              disabled={pending || !body.trim()}
              {...handlers}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-sm bg-accent-strong text-fg-on-accent transition-all hover:bg-accent-hover active:scale-[0.96] disabled:opacity-50"
              aria-label="Send"
            >
              <Message01Icon ref={icon} size={ICON_SIZE_SM} aria-hidden />
            </button>
          </form>
        )}

        {error && (
          <p
            role="alert"
            className="mt-2 px-2 text-xs font-bold text-status-danger"
          >
            {error}
          </p>
        )}
      </div>
    </Bezel>
  );
}

/**
 * Wall-clock time, formatted with a fixed locale and zone.
 *
 * `toLocaleTimeString()` with no arguments resolves both from the environment,
 * which differs between the server and the browser and fails hydration. This
 * component renders its initial list on the server, so that applies here.
 */
const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function timeOf(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : `${TIME.format(date)} UTC`;
}
