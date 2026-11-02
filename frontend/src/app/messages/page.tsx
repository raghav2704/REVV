
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

const API = "http://127.0.0.1:8000";

type Conversation = {
  id: number;
  vehicle_id: number;
  buyer_id: number;
  seller_id: number;
  year: number;
  make: string;
  model: string;
  last_message: string | null;
  unread_count: number;
};

type Message = {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  created_at: string;
  read_at: string | null;
};

type Account = {
  id: number;
};

async function readResponse<T>(
  response: Response
): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Please sign in to view your messages.");
    }

    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : `Request failed (${response.status})`
    );
  }

  return data as T;
}

export default function MessagesPage() {
  const params = useSearchParams();
  const requestedId = Number(params.get("conversation"));

  const [account, setAccount] = useState<Account | null>(null);
  const [threads, setThreads] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selected = threads.find((t) => t.id === selectedId);

  const loadThreads = useCallback(async () => {
    const response = await fetch(
      `${API}/api/v1/messages/conversations`,
      { credentials: "include", cache: "no-store" }
    );

    const result = await readResponse<{
      data: Conversation[];
    }>(response);

    if (!Array.isArray(result.data)) {
      throw new Error("Invalid conversations response.");
    }

    setThreads(result.data);

    setSelectedId((current) => {
      if (current !== null &&
          result.data.some((t) => t.id === current)) {
        return current;
      }

      if (Number.isInteger(requestedId) && requestedId > 0) {
        return result.data.find((t) => t.id === requestedId)?.id ??
          result.data[0]?.id ?? null;
      }

      return result.data[0]?.id ?? null;
    });
  }, [requestedId]);

  const loadMessages = useCallback(async (id: number) => {
    const response = await fetch(
      `${API}/api/v1/messages/conversations/${id}`,
      { credentials: "include", cache: "no-store" }
    );

    const result = await readResponse<{
      messages: Message[];
    }>(response);

    if (!Array.isArray(result.messages)) {
      throw new Error("Invalid message history.");
    }

    setMessages(result.messages);
  }, []);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const response = await fetch(
          `${API}/api/v1/auth/me`,
          { credentials: "include", cache: "no-store" }
        );

        const result = await readResponse<
          Account | { data: Account }
        >(response);

        if (!active) return;

        const currentAccount =
          "data" in result ? result.data : result;

        setAccount(currentAccount);
        await loadThreads();
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Inbox unavailable."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void init();

    return () => {
      active = false;
    };
  }, [loadThreads]);

  useEffect(() => {
    if (selectedId === null) {
      setMessages([]);
      return;
    }

    let active = true;
    setMessages([]);

    async function refresh() {
      try {
        const response = await fetch(
          `${API}/api/v1/messages/conversations/${selectedId}`,
          { credentials: "include", cache: "no-store" }
        );

        const result = await readResponse<{
          messages: Message[];
        }>(response);

        if (active) setMessages(result.messages);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Unable to load messages."
          );
        }
      }
    }

    void refresh();

    const timer = window.setInterval(() => {
      void refresh();
      void loadThreads().catch(() => {});
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedId, loadThreads]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedId || !draft.trim() || busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/v1/messages/conversations/${selectedId}/messages`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: draft.trim() }),
        }
      );

      await readResponse<Message>(response);

      setDraft("");
      await loadMessages(selectedId);
      await loadThreads();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Message failed."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080F1C] p-10 text-white">
        Loading REVV Messages...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080F1C] px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/"
          className="text-sm font-medium text-blue-400"
        >
          ← Back to REVV
        </Link>

        <h1 className="mt-7 text-4xl font-black">
          REVV Messages
        </h1>

        <p className="mt-2 text-slate-400">
          Secure conversations about your vehicles.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-red-200"
          >
            {error}
          </div>
        )}

        <div className="mt-8 grid min-h-[550px] gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="overflow-hidden rounded-2xl border border-white/10 bg-[#111E32]">
            <div className="border-b border-white/10 p-5">
              <h2 className="font-bold">Inbox</h2>
              <p className="mt-1 text-xs text-slate-400">
                {threads.length} conversations
              </p>
            </div>

            <div className="max-h-[650px] overflow-y-auto">
              {threads.length === 0 ? (
                <p className="p-5 text-sm text-slate-400">
                  No conversations yet.
                </p>
              ) : (
                threads.map((thread) => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(thread.id);
                      setError("");
                    }}
                    className={`w-full border-b border-white/5 p-5 text-left transition hover:bg-[#1B304D] ${
                      selectedId === thread.id
                        ? "bg-[#20395A]"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">
                        {thread.year} {thread.make} {thread.model}
                      </span>

                      {thread.unread_count > 0 && (
                        <span className="rounded-full bg-blue-600 px-2 py-1 text-xs">
                          {thread.unread_count}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 truncate text-xs text-slate-400">
                      {thread.last_message || "No messages yet"}
                    </p>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex min-h-[550px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111E32]">
            {!selected ? (
              <div className="flex flex-1 items-center justify-center p-8 text-slate-400">
                Select a conversation to begin.
              </div>
            ) : (
              <>
                <div className="border-b border-white/10 bg-[#132239] p-5">
                  <h2 className="text-lg font-bold">
                    {selected.year} {selected.make} {selected.model}
                  </h2>

                  <Link
                    href={`/cars/${selected.vehicle_id}`}
                    className="mt-1 inline-block text-xs text-blue-300 hover:underline"
                  >
                    View vehicle listing
                  </Link>
                </div>

                <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
                  {messages.map((message) => {
                    const mine = message.sender_id === account?.id;

                    return (
                      <div
                        key={message.id}
                        className={`flex ${
                          mine ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                            mine
                              ? "bg-blue-600 text-white"
                              : "bg-[#263A55] text-slate-100"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">
                            {message.body}
                          </p>

                          <p className="mt-2 text-[10px] opacity-65">
                            {new Date(
                              message.created_at
                            ).toLocaleString("en-NZ")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <form
                  onSubmit={sendMessage}
                  className="flex gap-3 border-t border-white/10 p-4"
                >
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    maxLength={2000}
                    disabled={busy}
                    placeholder="Type your message..."
                    className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0B1628] px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                  />

                  <button
                    type="submit"
                    disabled={busy || !draft.trim()}
                    className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold hover:bg-blue-500 disabled:opacity-50"
                  >
                    {busy ? "Sending..." : "Send"}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
