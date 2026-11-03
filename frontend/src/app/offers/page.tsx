
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const API = typeof window === "undefined" ? "http://127.0.0.1:8000" : window.location.origin;

type Account = {
  id: number;
  full_name: string;
};

type Offer = {
  id: number;
  vehicle_id: number;
  buyer_id: number;
  seller_id: number;
  buyer_name: string;
  seller_name: string;
  year: number;
  make: string;
  model: string;
  current_amount_nzd: number;
  conditions: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type OfferEvent = {
  id: number;
  actor_id: number;
  actor_name: string;
  action: string;
  amount_nzd: number;
  conditions: string;
  created_at: string;
};

type OfferDetail = {
  offer: Offer;
  history: OfferEvent[];
};

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(amount);

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

const STATUS_TEXT: Record<string, string> = {
  pending_seller: "Awaiting Seller",
  pending_buyer: "Awaiting Buyer",
  accepted: "Agreed in Principle",
  declined: "Declined",
  withdrawn: "Withdrawn",
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

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : response.status === 401
          ? "Please log in to use Deal Room."
          : `Request failed (${response.status})`
    );
  }

  return data as T;
}

export default function OffersPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [history, setHistory] = useState<OfferEvent[]>([]);

  const [counterAmount, setCounterAmount] = useState("");
  const [conditions, setConditions] = useState("");
  const [showCounter, setShowCounter] = useState(false);

  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedIdRef = useRef<number | null>(null);
  const requestRef = useRef(0);
  const busyRef = useRef(false);

  const refreshOffers = useCallback(async () => {
    const response = await api<{ data: Offer[] }>(
      "/api/v1/deals/offers"
    );

    if (!Array.isArray(response.data)) {
      throw new Error("Invalid offers response.");
    }

    setOffers(response.data);
    return response.data;
  }, []);

  const openOffer = useCallback(
    async (id: number, silent = false) => {
      const requestId = ++requestRef.current;

      selectedIdRef.current = id;

      if (!silent) {
        setOpening(true);
        setError("");
        setShowCounter(false);
      }

      try {
        const result = await api<OfferDetail>(
          `/api/v1/deals/offers/${id}`
        );

        if (requestId !== requestRef.current) {
          return;
        }

        setSelected(result.offer);
        setHistory(result.history);

        if (!silent) {
          setCounterAmount(
            String(result.offer.current_amount_nzd)
          );
          setConditions(result.offer.conditions || "");
        }
      } catch (err) {
        if (requestId === requestRef.current && !silent) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to open negotiation."
          );
        }
      } finally {
        if (requestId === requestRef.current && !silent) {
          setOpening(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const auth = await api<
          Account | { data: Account }
        >("/api/v1/auth/me");

        if (!active) return;

        const user = "data" in auth ? auth.data : auth;

        if (!user || !Number.isInteger(user.id)) {
          throw new Error("Invalid account session.");
        }

        setAccount(user);

        const list = await refreshOffers();

        if (!active || list.length === 0) return;

        const params = new URLSearchParams(
          window.location.search
        );

        const requestedId = Number(
          params.get("offer")
        );

        const requestedOffer = list.find(
          (offer) => offer.id === requestedId
        );

        const firstOffer = requestedOffer ?? list[0];

        await openOffer(firstOffer.id);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load Deal Room."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [refreshOffers, openOffer]);

  useEffect(() => {
    if (!account) return;

    const timer = window.setInterval(async () => {
      if (
        document.visibilityState !== "visible" ||
        busyRef.current
      ) {
        return;
      }

      try {
        await refreshOffers();

        const id = selectedIdRef.current;

        if (id !== null) {
          await openOffer(id, true);
        }
      } catch {
        // Temporary polling errors shouldn't clear the page.
      }
    }, 10000);

    return () => window.clearInterval(timer);
  }, [account, refreshOffers, openOffer]);

  function chooseOffer(id: number) {
    setNotice("");
    setError("");

    const url = new URL(window.location.href);
    url.searchParams.set("offer", String(id));

    window.history.replaceState(
      null,
      "",
      url.pathname + url.search
    );

    void openOffer(id);
  }

  async function respond(
    action: "accept" | "decline" | "counter" | "withdraw"
  ) {
    if (!selected || busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");

    const id = selected.id;

    try {
      const body: {
        action: string;
        amount_nzd?: number;
        conditions?: string;
      } = { action };

      if (action === "counter") {
        const amount = Number(counterAmount);
        const newConditions = conditions.trim();

        if (
          !Number.isInteger(amount) ||
          amount < 1 ||
          amount > 100000000
        ) {
          throw new Error("Enter a valid counteroffer amount.");
        }

        if (
          amount === selected.current_amount_nzd &&
          newConditions === selected.conditions.trim()
        ) {
          throw new Error(
            "Change the price or conditions before countering."
          );
        }

        body.amount_nzd = amount;
        body.conditions = newConditions;
      }

      await api(
        `/api/v1/deals/offers/${id}/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      await openOffer(id);
      await refreshOffers();

      setShowCounter(false);

      const messages = {
        accept: "Offer accepted in principle.",
        decline: "Offer declined.",
        counter: "Your counteroffer has been sent.",
        withdraw: "Your offer has been withdrawn.",
      };

      setNotice(messages[action]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update negotiation."
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const amBuyer =
    account !== null &&
    selected !== null &&
    selected.buyer_id === account.id;

  const amSeller =
    account !== null &&
    selected !== null &&
    selected.seller_id === account.id;

  const otherName = selected
    ? amBuyer
      ? selected.seller_name
      : selected.buyer_name
    : "";

  const myTurn =
    selected !== null &&
    (
      (selected.status === "pending_seller" &&
        amSeller) ||
      (selected.status === "pending_buyer" &&
        amBuyer)
    );

  const canWithdraw =
    selected?.status === "pending_seller" && amBuyer;

  const isClosed = [
    "accepted",
    "declined",
    "withdrawn",
  ].includes(selected?.status || "");

  const card =
    "overflow-hidden rounded-2xl border border-white/10 bg-[#111E32]";

  return (
    <main className="min-h-screen bg-[#080F1C] px-4 py-9 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        {/* PAGE HEADER */}

        <Link
          href="/"
          className="text-sm font-semibold text-blue-300 hover:text-white"
        >
          ← Back to REVV
        </Link>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-400">
              REVV / DEAL ROOM
            </p>

            <h1 className="mt-3 text-3xl font-black sm:text-4xl">
              Your Negotiations
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Review proposals, negotiate with confidence
              and keep every decision recorded.
            </p>
          </div>

          <Link
            href="/#explore"
            className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold transition hover:bg-white/10"
          >
            Explore Cars
          </Link>
        </div>

        {/* FEEDBACK */}

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"
          >
            {notice}
          </div>
        )}

        {loading ? (
          <div className={`${card} mt-8 p-12 text-center text-slate-400`}>
            Loading Deal Room...
          </div>
        ) : !account ? (
          <div className={`${card} mt-8 p-10 text-center`}>
            <h2 className="text-xl font-bold">
              Sign in to access your negotiations.
            </h2>

            <Link
              href="/login"
              className="mt-5 inline-block rounded-xl bg-blue-600 px-6 py-3 font-bold"
            >
              Sign In
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            {/* DEAL INBOX */}

            <aside className={card}>
              <div className="flex items-center justify-between border-b border-white/10 p-5">
                <div>
                  <h2 className="font-bold">
                    Deal Inbox
                  </h2>

                  <p className="mt-1 text-xs text-slate-400">
                    Active and past offers
                  </p>
                </div>

                <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                  {offers.length}
                </span>
              </div>

              {offers.length === 0 ? (
                <div className="p-9 text-center">
                  <p className="text-4xl">🤝</p>

                  <h3 className="mt-4 font-bold">
                    No negotiations yet
                  </h3>

                  <p className="mt-2 text-sm text-slate-400">
                    Find a vehicle and make an offer to get started.
                  </p>
                </div>
              ) : (
                <div className="max-h-[700px] overflow-y-auto">
                  {offers.map((offer) => {
                    const active =
                      offer.id === selected?.id;

                    const other =
                      offer.buyer_id === account.id
                        ? offer.seller_name
                        : offer.buyer_name;

                    const needsMe =
                      (offer.status === "pending_seller" &&
                        offer.seller_id === account.id) ||
                      (offer.status === "pending_buyer" &&
                        offer.buyer_id === account.id);

                    return (
                      <button
                        key={offer.id}
                        type="button"
                        onClick={() =>
                          chooseOffer(offer.id)
                        }
                        className={`w-full border-b border-white/5 p-5 text-left transition ${
                          active
                            ? "border-l-4 border-l-blue-500 bg-[#203653]"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-bold">
                            {offer.year} {offer.make}{" "}
                            {offer.model}
                          </p>

                          {needsMe && (
                            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-400" />
                          )}
                        </div>

                        <p className="mt-2 truncate text-xs text-slate-400">
                          With {other}
                        </p>

                        <p className="mt-3 text-xl font-black text-blue-300">
                          {formatMoney(
                            offer.current_amount_nzd
                          )}
                        </p>

                        <p
                          className={`mt-2 text-xs ${
                            needsMe
                              ? "font-bold text-blue-300"
                              : "text-slate-400"
                          }`}
                        >
                          {needsMe
                            ? "● Your response needed"
                            : STATUS_TEXT[offer.status] ||
                              offer.status}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            {/* ACTIVE DEAL ROOM */}

            <section className={card}>
              {!selected ? (
                <div className="p-14 text-center text-slate-400">
                  Select a negotiation to view its details.
                </div>
              ) : (
                <div className={opening ? "opacity-60" : ""}>
                  {/* DEAL HEADER */}

                  <div className="border-b border-white/10 bg-[#14243A] p-6 sm:p-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wider text-blue-400">
                          PRIVATE DEAL ROOM / #{selected.id}
                        </p>

                        <h2 className="mt-3 text-2xl font-black">
                          {selected.year} {selected.make}{" "}
                          {selected.model}
                        </h2>

                        <p className="mt-2 text-sm text-slate-400">
                          Negotiating with {otherName}
                        </p>
                      </div>

                      <Link
                        href={`/cars/${selected.vehicle_id}`}
                        className="rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-blue-200 transition hover:bg-white/10"
                      >
                        View Listing ↗
                      </Link>
                    </div>

                    {/* USER DETAILS */}

                    <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0B1628] p-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 font-black">
                        {initials(otherName)}
                      </div>

                      <div>
                        <p className="text-sm font-bold">
                          {otherName}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {amBuyer ? "Seller" : "Buyer"} · REVV account
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* CURRENT OFFER */}

                  <div className="p-6 sm:p-8">
                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-blue-200">
                          Current Proposal
                        </p>

                        <span className="rounded-full bg-[#203A5B] px-3 py-1.5 text-xs font-semibold text-blue-100">
                          {STATUS_TEXT[selected.status] ||
                            selected.status}
                        </span>
                      </div>

                      <p className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
                        {formatMoney(
                          selected.current_amount_nzd
                        )}
                      </p>

                      <p className="mt-4 text-sm leading-6 text-slate-300">
                        {selected.conditions ||
                          "No additional conditions specified."}
                      </p>
                    </div>

                    {/* DECISION PANEL */}

                    <div className="mt-7 rounded-2xl border border-white/10 bg-[#0C1829] p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-xl">
                          {isClosed
                            ? "✓"
                            : myTurn
                              ? "!"
                              : "◷"}
                        </div>

                        <div>
                          <h3 className="font-bold">
                            {selected.status === "accepted"
                              ? "Terms agreed in principle"
                              : selected.status === "declined"
                                ? "Negotiation declined"
                                : selected.status === "withdrawn"
                                  ? "Offer withdrawn"
                                  : myTurn
                                    ? "Your decision is needed"
                                    : `Waiting for ${otherName}`}
                          </h3>

                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            {isClosed
                              ? "This negotiation is closed."
                              : myTurn
                                ? "Review the current proposal and make your move."
                                : "You'll see updates here when the other person responds."}
                          </p>
                        </div>
                      </div>

                      {/* ACTION BUTTONS */}

                      {myTurn && (
                        <div className="mt-6">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              disabled={busy || opening}
                              onClick={() =>
                                void respond("accept")
                              }
                              className="rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold transition hover:bg-blue-500 disabled:opacity-50"
                            >
                              Accept Terms
                            </button>

                            <button
                              type="button"
                              disabled={busy || opening}
                              onClick={() =>
                                setShowCounter((value) => !value)
                              }
                              className="rounded-xl border border-blue-400/30 px-5 py-3.5 text-sm font-bold text-blue-200 transition hover:bg-blue-500/10 disabled:opacity-50"
                            >
                              Make Counteroffer
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={busy || opening}
                            onClick={() =>
                              void respond("decline")
                            }
                            className="mt-4 w-full py-2 text-sm font-semibold text-red-300 hover:text-red-200 disabled:opacity-50"
                          >
                            Decline Proposal
                          </button>

                          {/* COUNTEROFFER FORM */}

                          {showCounter && (
                            <div className="mt-6 space-y-5 border-t border-white/10 pt-6">
                              <h4 className="text-lg font-bold">
                                Create Counteroffer
                              </h4>

                              <div>
                                <label
                                  htmlFor="counter-amount"
                                  className="mb-2 block text-sm font-semibold text-slate-300"
                                >
                                  Proposed price (NZD)
                                </label>

                                <input
                                  id="counter-amount"
                                  type="number"
                                  min={1}
                                  max={100000000}
                                  step={1}
                                  value={counterAmount}
                                  onChange={(event) =>
                                    setCounterAmount(
                                      event.target.value
                                    )
                                  }
                                  className="w-full rounded-xl border border-white/15 bg-[#14243A] px-4 py-3 text-white outline-none focus:border-blue-500"
                                />
                              </div>

                              <div>
                                <label
                                  htmlFor="counter-conditions"
                                  className="mb-2 block text-sm font-semibold text-slate-300"
                                >
                                  Conditions
                                </label>

                                <textarea
                                  id="counter-conditions"
                                  rows={3}
                                  maxLength={1000}
                                  value={conditions}
                                  onChange={(event) =>
                                    setConditions(
                                      event.target.value
                                    )
                                  }
                                  className="w-full resize-none rounded-xl border border-white/15 bg-[#14243A] px-4 py-3 text-white outline-none focus:border-blue-500"
                                />
                              </div>

                              <button
                                type="button"
                                disabled={busy || opening}
                                onClick={() =>
                                  void respond("counter")
                                }
                                className="w-full rounded-xl bg-blue-600 px-5 py-3.5 font-bold transition hover:bg-blue-500 disabled:opacity-50"
                              >
                                {busy
                                  ? "Sending..."
                                  : "Send Counteroffer →"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {canWithdraw && (
                        <button
                          type="button"
                          disabled={busy || opening}
                          onClick={() =>
                            void respond("withdraw")
                          }
                          className="mt-5 text-xs font-semibold text-red-300 hover:underline disabled:opacity-50"
                        >
                          Withdraw my pending offer
                        </button>
                      )}
                    </div>

                    {/* NEGOTIATION TIMELINE */}

                    <section className="mt-10">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-xl font-black">
                          Negotiation Timeline
                        </h3>

                        <span className="text-xs text-slate-400">
                          {history.length} events
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-400">
                        Every proposal and response is recorded.
                      </p>

                      <div className="mt-6">
                        {history.map((event, index) => (
                          <div
                            key={event.id}
                            className="flex gap-4"
                          >
                            <div className="flex flex-col items-center">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-400/30 bg-[#183454] text-xs font-bold text-blue-200">
                                {index + 1}
                              </div>

                              {index < history.length - 1 && (
                                <div className="my-2 min-h-6 w-px flex-1 bg-white/15" />
                              )}
                            </div>

                            <div className="mb-4 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0D192B] p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-bold">
                                  {event.actor_name}
                                </p>

                                <span className="text-xs font-semibold capitalize text-blue-300">
                                  {event.action}
                                </span>
                              </div>

                              <p className="mt-3 text-xl font-black">
                                {formatMoney(
                                  event.amount_nzd
                                )}
                              </p>

                              {event.conditions && (
                                <p className="mt-2 text-xs leading-5 text-slate-400">
                                  {event.conditions}
                                </p>
                              )}

                              <p className="mt-3 text-xs text-slate-500">
                                {formatDate(event.created_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* SAFETY */}

                    <div className="mt-5 rounded-xl border border-white/10 p-5 text-xs leading-6 text-slate-400">
                      REVV records proposals and negotiation
                      decisions. Accepted terms represent an
                      agreement in principle within the platform,
                      not confirmed payment, ownership transfer
                      or legal completion.
                    </div>

                    <Link
                      href="/messages"
                      className="mt-5 block rounded-xl border border-white/15 px-5 py-3.5 text-center text-sm font-bold transition hover:bg-white/10"
                    >
                      Open REVV Messages
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
