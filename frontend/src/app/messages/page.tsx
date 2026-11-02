
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

const API = "http://127.0.0.1:8000";

type Account = {
  id: number;
  full_name?: string;
  role?: string;
};

type Conversation = {
  id: number;
  vehicle_id: number;
  buyer_id: number;
  seller_id: number;
  buyer_name: string;
  seller_name: string;
  year: number;
  make: string;
  model: string;
  last_message: string | null;
  unread_count: number;
  updated_at: string;
};

type Message = {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  created_at: string;
  read_at: string | null;
};

type MessageHistory = {
  messages: Message[];
  has_more: boolean;
};

async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...options,
    credentials: "include",
    cache: "no-store",
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Please log in to access your messages.");
    }

    throw new Error(
      typeof result?.detail === "string"
        ? result.detail
        : `Request failed (${response.status})`
    );
  }

  return result as T;
}

function timeLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function dayLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function getOtherName(
  thread: Conversation,
  userId: number
) {
  return thread.seller_id === userId
    ? thread.buyer_name
    : thread.seller_name;
}

export default function MessagesPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [threads, setThreads] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState("");

  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");

  const selectedIdRef = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstLoadRef = useRef(true);

  const selected = threads.find(
    (thread) => thread.id === selectedId
  );

  const totalUnread = threads.reduce(
    (sum, thread) => sum + Number(thread.unread_count || 0),
    0
  );

  const otherName =
    selected && account
      ? getOtherName(selected, account.id)
      : "";

  const amSeller =
    selected !== undefined &&
    account !== null &&
    selected.seller_id === account.id;

  const refreshThreads = useCallback(async () => {
    const result = await api<{ data: Conversation[] }>(
      "/api/v1/messages/conversations"
    );

    if (!Array.isArray(result.data)) {
      throw new Error("Invalid inbox response.");
    }

    setThreads(result.data);
    return result.data;
  }, []);

  const fetchMessages = useCallback(async (id: number) => {
    const result = await api<MessageHistory>(
      `/api/v1/messages/conversations/${id}`
    );

    if (!Array.isArray(result.messages)) {
      throw new Error("Invalid message history.");
    }

    if (selectedIdRef.current === id) {
      setMessages(result.messages);
      setHasMore(Boolean(result.has_more));
    }
  }, []);

  const markRead = useCallback(async (id: number) => {
    await api(
      `/api/v1/messages/conversations/${id}/read`,
      { method: "POST" }
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const auth = await api<
          Account | { data: Account }
        >("/api/v1/auth/me");

        const user = "data" in auth ? auth.data : auth;

        if (!user || !Number.isInteger(user.id)) {
          throw new Error("Invalid account session.");
        }

        if (cancelled) return;
        setAccount(user);

        const list = await refreshThreads();
        if (cancelled) return;

        const requested = Number(
          new URLSearchParams(
            window.location.search
          ).get("conversation")
        );

        const initial =
          list.find((t) => t.id === requested)?.id ??
          list[0]?.id ??
          null;

        setSelectedId(initial);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your inbox."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [refreshThreads]);

  useEffect(() => {
    if (selectedId === null) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    const id = selectedId;

    selectedIdRef.current = id;
    firstLoadRef.current = true;

    setChatLoading(true);
    setMessages([]);

    async function load() {
      try {
        const result = await api<MessageHistory>(
          `/api/v1/messages/conversations/${id}`
        );

        if (cancelled) return;

        setMessages(result.messages);
        setHasMore(Boolean(result.has_more));

        await markRead(id);

        if (!cancelled) {
          await refreshThreads();
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load messages."
          );
        }
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [selectedId, markRead, refreshThreads]);

  useEffect(() => {
    if (!account) return;

    const interval = window.setInterval(async () => {
      if (document.visibilityState === "hidden") return;

      try {
        await refreshThreads();

        const id = selectedIdRef.current;

        if (id !== null) {
          await fetchMessages(id);
          await markRead(id);
          await refreshThreads();
        }
      } catch {
        // A temporary network issue shouldn't erase the chat.
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [account, refreshThreads, fetchMessages, markRead]);

  useEffect(() => {
    if (messages.length === 0) return;

    if (firstLoadRef.current) {
      bottomRef.current?.scrollIntoView({
        behavior: "instant",
      });

      firstLoadRef.current = false;
    }
  }, [messages]);

  async function loadOlderMessages() {
    if (
      selectedId === null ||
      loadingOlder ||
      !hasMore ||
      messages.length === 0
    ) {
      return;
    }

    const id = selectedId;
    const beforeId = messages[0].id;

    setLoadingOlder(true);
    setError("");

    try {
      const result = await api<MessageHistory>(
        `/api/v1/messages/conversations/${id}?before_id=${beforeId}`
      );

      if (selectedIdRef.current !== id) return;

      setMessages((previous) => {
        const existingIds = new Set(
          previous.map((message) => message.id)
        );

        return [
          ...result.messages.filter(
            (message) => !existingIds.has(message.id)
          ),
          ...previous,
        ];
      });

      setHasMore(Boolean(result.has_more));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load older messages."
      );
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const id = selectedId;
    const content = draft.trim();

    if (!id || !content || sending) return;

    setSending(true);
    setError("");

    try {
      await api(
        `/api/v1/messages/conversations/${id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: content }),
        }
      );

      setDraft("");
      await fetchMessages(id);
      await refreshThreads();

      bottomRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send your message."
      );
    } finally {
      setSending(false);
    }
  }

  function chooseConversation(id: number) {
    setSelectedId(id);
    setError("");

    const url = new URL(window.location.href);
    url.searchParams.set("conversation", String(id));

    window.history.replaceState(
      null,
      "",
      url.pathname + url.search
    );
  }

  const panelClass =
    "overflow-hidden rounded-2xl border border-white/10 bg-[#111E32]";

  return (
    <main className="min-h-screen bg-[#080F1C] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}

        <div className="mb-8">
          <Link
            href="/"
            className="text-sm font-semibold text-blue-400 hover:text-blue-300"
          >
            ← Back to REVV
          </Link>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
                REVV / COMMUNICATIONS
              </p>

              <h1 className="mt-2 text-3xl font-black sm:text-4xl">
                Your Messages
              </h1>

              <p className="mt-2 text-sm text-slate-400">
                Connect with buyers and sellers securely.
              </p>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
              <p className="text-xs text-slate-400">
                Unread messages
              </p>

              <p className="mt-1 text-2xl font-black text-blue-300">
                {totalUnread}
              </p>
            </div>
          </div>
        </div>

        {/* ERRORS */}

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-[#111E32] p-12 text-center text-slate-300">
            Loading your inbox...
          </div>
        ) : !account ? (
          <div className="rounded-2xl bg-[#111E32] p-10 text-center">
            <p className="text-slate-300">
              Sign in to access your conversations.
            </p>

            <Link
              href="/login"
              className="mt-5 inline-block rounded-xl bg-blue-600 px-6 py-3 font-bold"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            {/* INBOX */}

            <aside className={panelClass}>
              <div className="border-b border-white/10 bg-[#132239] p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">
                    Inbox
                  </h2>

                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
                    {threads.length}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-400">
                  Your conversations
                </p>
              </div>

              <div className="max-h-[650px] overflow-y-auto">
                {threads.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-4xl">💬</p>

                    <p className="mt-3 font-semibold">
                      No conversations yet
                    </p>

                    <p className="mt-2 text-sm text-slate-400">
                      Your buyer and seller enquiries will appear here.
                    </p>
                  </div>
                ) : (
                  threads.map((thread) => {
                    const active = thread.id === selectedId;

                    const sellerViewing =
                      thread.seller_id === account.id;

                    const name = getOtherName(
                      thread,
                      account.id
                    );

                    return (
                      <button
                        type="button"
                        key={thread.id}
                        onClick={() =>
                          chooseConversation(thread.id)
                        }
                        className={`w-full border-b border-white/5 p-5 text-left transition ${
                          active
                            ? "border-l-4 border-l-blue-500 bg-[#20395A]"
                            : "hover:bg-[#192D47]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* ACCOUNT AVATAR */}

                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600/25 text-sm font-black text-blue-200">
                            {initials(name)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-sm font-bold text-white">
                                {name}
                              </p>

                              {thread.unread_count > 0 && (
                                <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold">
                                  {thread.unread_count}
                                </span>
                              )}
                            </div>

                            <p className="mt-1 text-xs font-medium text-blue-300">
                              {sellerViewing
                                ? "Buyer"
                                : "Seller"}
                            </p>

                            <p className="mt-1 truncate text-xs text-slate-300">
                              {thread.year} {thread.make}{" "}
                              {thread.model}
                            </p>

                            <p className="mt-2 truncate text-xs text-slate-400">
                              {thread.last_message || "Start chatting"}
                            </p>

                            <p className="mt-2 text-[11px] text-slate-500">
                              {dayLabel(thread.updated_at)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* CONVERSATION WINDOW */}

            <section
              className={`${panelClass} flex min-h-[600px] flex-col`}
            >
              {!selected ? (
                <div className="flex flex-1 flex-col items-center justify-center p-10 text-center">
                  <p className="text-5xl">🚘</p>

                  <h2 className="mt-4 text-xl font-bold">
                    Welcome to REVV Messages
                  </h2>

                  <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
                    Choose a conversation to start messaging.
                  </p>
                </div>
              ) : (
                <>
                  {/* CONVERSATION HEADER */}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#132239] p-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-black text-white">
                        {initials(otherName)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold text-white">
                          {otherName}
                        </p>

                        <p className="mt-1 text-xs text-blue-300">
                          {amSeller ? "Buyer" : "Seller"} · REVV account
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {selected.year} {selected.make}{" "}
                          {selected.model}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/cars/${selected.vehicle_id}`}
                      className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-blue-200 transition hover:bg-white/10"
                    >
                      View vehicle →
                    </Link>
                  </div>

                  {/* MESSAGE HISTORY */}

                  <div className="flex h-[430px] flex-col gap-4 overflow-y-auto bg-[#0E192B] p-5 sm:p-7">
                    {hasMore && (
                      <button
                        type="button"
                        disabled={loadingOlder}
                        onClick={() =>
                          void loadOlderMessages()
                        }
                        className="self-center rounded-lg border border-white/15 px-4 py-2 text-xs font-bold text-blue-300 hover:bg-white/5 disabled:opacity-50"
                      >
                        {loadingOlder
                          ? "Loading..."
                          : "Load older messages"}
                      </button>
                    )}

                    {chatLoading ? (
                      <p className="text-center text-sm text-slate-400">
                        Loading messages...
                      </p>
                    ) : messages.length === 0 ? (
                      <p className="my-auto text-center text-sm text-slate-400">
                        No messages yet.
                      </p>
                    ) : (
                      messages.map((message) => {
                        const mine =
                          message.sender_id === account.id;

                        const senderName = mine
                          ? "You"
                          : otherName;

                        return (
                          <div
                            key={message.id}
                            className={`flex ${
                              mine
                                ? "justify-end"
                                : "justify-start"
                            }`}
                          >
                            <div className="max-w-[85%] sm:max-w-[70%]">
                              <div
                                className={`mb-1 flex items-center gap-2 ${
                                  mine
                                    ? "justify-end"
                                    : "justify-start"
                                }`}
                              >
                                {!mine && (
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#344E70] text-[9px] font-bold">
                                    {initials(otherName)}
                                  </div>
                                )}

                                <p className="text-[11px] font-semibold text-blue-300">
                                  {senderName}
                                </p>
                              </div>

                              <div
                                className={`rounded-2xl px-4 py-3 shadow-sm ${
                                  mine
                                    ? "rounded-br-sm bg-blue-600"
                                    : "rounded-bl-sm border border-white/5 bg-[#263A55]"
                                }`}
                              >
                                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white">
                                  {message.body}
                                </p>

                                <div className="mt-2 flex items-center justify-end gap-2">
                                  <span className="text-[10px] text-white/65">
                                    {timeLabel(
                                      message.created_at
                                    )}
                                  </span>

                                  {mine && (
                                    <span className="text-[10px] text-white/70">
                                      {message.read_at
                                        ? "Read ✓✓"
                                        : "Sent ✓"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}

                    <div ref={bottomRef} />
                  </div>

                  {/* MESSAGE COMPOSER */}

                  <div className="border-t border-white/10 bg-[#132239] p-4 sm:p-5">
                    <form
                      onSubmit={send}
                      className="flex items-end gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <label
                          htmlFor="revv-message"
                          className="mb-2 block text-xs font-medium text-slate-400"
                        >
                          Message {otherName}
                        </label>

                        <textarea
                          id="revv-message"
                          value={draft}
                          onChange={(event) =>
                            setDraft(event.target.value)
                          }
                          maxLength={2000}
                          rows={2}
                          disabled={sending}
                          placeholder={`Write a message to ${otherName}...`}
                          className="w-full resize-none rounded-xl border border-white/15 bg-[#0B1628] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={sending || !draft.trim()}
                        className="rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {sending
                          ? "Sending..."
                          : "Send →"}
                      </button>
                    </form>

                    <p className="mt-3 text-xs text-slate-500">
                      Stay safe: verify the vehicle and seller
                      before making payments or deposits.
                    </p>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
