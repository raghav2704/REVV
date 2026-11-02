
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

const API = "http://127.0.0.1:8000";

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

const money = (value: number) =>
  new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    cache: "no-store",
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data?.detail === "string"
        ? data.detail
        : response.status === 401
          ? "Please sign in."
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

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refresh = useCallback(async () => {
    const data = await request<{ data: Offer[] }>(
      "/api/v1/deals/offers"
    );

    setOffers(data.data);
    return data.data;
  }, []);

  const openOffer = useCallback(async (id: number) => {
    const data = await request<{
      offer: Offer;
      history: OfferEvent[];
    }>(`/api/v1/deals/offers/${id}`);

    setSelected(data.offer);
    setHistory(data.history);
    setCounterAmount(String(data.offer.current_amount_nzd));
    setConditions(data.offer.conditions);
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const me = await request<Account | { data: Account }>(
          "/api/v1/auth/me"
        );

        const user = "data" in me ? me.data : me;
        if (!active) return;

        setAccount(user);
        const list = await refresh();

        if (active && list.length > 0) {
          await openOffer(list[0].id);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Unable to load offers"
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
  }, [refresh, openOffer]);

  async function act(
    action: "accept" | "decline" | "counter" | "withdraw"
  ) {
    if (!selected || busy) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const body: {
        action: string;
        amount_nzd?: number;
        conditions?: string;
      } = { action };

      if (action === "counter") {
        const amount = Number(counterAmount);

        if (!Number.isInteger(amount) || amount <= 0) {
          throw new Error("Enter a valid counteroffer amount.");
        }

        body.amount_nzd = amount;
        body.conditions = conditions;
      }

      await request(
        `/api/v1/deals/offers/${selected.id}/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      await openOffer(selected.id);
      await refresh();

      setSuccess(
        action === "accept"
          ? "Offer accepted in principle."
          : action === "counter"
            ? "Counteroffer sent."
            : action === "decline"
              ? "Offer declined."
              : "Offer withdrawn."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Action failed"
      );
    } finally {
      setBusy(false);
    }
  }

  const myTurn =
    selected !== null &&
    account !== null &&
    (
      (selected.status === "pending_seller" &&
        selected.seller_id === account.id) ||
      (selected.status === "pending_buyer" &&
        selected.buyer_id === account.id)
    );

  const canWithdraw =
    selected !== null &&
    account !== null &&
    selected.buyer_id === account.id &&
    selected.status === "pending_seller";

  const otherName =
    selected && account
      ? selected.buyer_id === account.id
        ? selected.seller_name
        : selected.buyer_name
      : "";

  const terminal =
    selected?.status === "accepted" ||
    selected?.status === "declined" ||
    selected?.status === "withdrawn";

  return (
    <main className="min-h-screen bg-[#080F1C] px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="text-sm text-blue-300">
          ← Back to REVV
        </Link>

        <p className="mt-9 text-xs font-bold uppercase tracking-widest text-blue-400">
          REVV / DEAL ROOM
        </p>

        <h1 className="mt-2 text-4xl font-black">
          Negotiations
        </h1>

        <p className="mt-3 text-slate-400">
          Make a deal with clear terms, recorded offers
          and transparent responses.
        </p>

        {error && (
          <p role="alert" className="mt-5 text-sm text-red-300">
            {error}
          </p>
        )}

        {success && (
          <p role="status" className="mt-5 text-sm text-green-300">
            {success}
          </p>
        )}

        {loading ? (
          <p className="mt-8 text-slate-400">
            Loading negotiations...
          </p>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-2xl border border-white/10 bg-[#111E32]">
              <div className="border-b border-white/10 p-5">
                <h2 className="font-bold">Your Offers</h2>
              </div>

              {offers.length === 0 ? (
                <div className="p-7 text-sm text-slate-400">
                  No offers yet. Browse vehicles to make your first offer.
                </div>
              ) : (
                offers.map((offer) => (
                  <button
                    type="button"
                    key={offer.id}
                    onClick={() => {
                      setError("");
                      setSuccess("");
                      void openOffer(offer.id);
                    }}
                    className={`w-full border-b border-white/5 p-5 text-left transition hover:bg-white/5 ${
                      selected?.id === offer.id
                        ? "bg-blue-500/15"
                        : ""
                    }`}
                  >
                    <p className="font-bold">
                      {offer.year} {offer.make} {offer.model}
                    </p>

                    <p className="mt-2 text-lg font-black text-blue-300">
                      {money(offer.current_amount_nzd)}
                    </p>

                    <p className="mt-2 text-xs capitalize text-slate-400">
                      {offer.status.replaceAll("_", " ")}
                    </p>
                  </button>
                ))
              )}
            </aside>

            <section className="rounded-2xl border border-white/10 bg-[#111E32] p-6 sm:p-8">
              {!selected ? (
                <p className="text-slate-400">
                  Select a negotiation to view its details.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
                        NEGOTIATION #{selected.id}
                      </p>

                      <h2 className="mt-2 text-2xl font-black">
                        {selected.year} {selected.make}{" "}
                        {selected.model}
                      </h2>

                      <p className="mt-2 text-sm text-slate-400">
                        Negotiating with {otherName}
                      </p>
                    </div>

                    <Link
                      href={`/cars/${selected.vehicle_id}`}
                      className="rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-blue-200 hover:bg-white/10"
                    >
                      View Vehicle
                    </Link>
                  </div>

                  <div className="mt-7 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-6">
                    <p className="text-sm text-slate-400">
                      Current proposed price
                    </p>

                    <p className="mt-2 text-4xl font-black text-blue-300">
                      {money(selected.current_amount_nzd)}
                    </p>

                    <p className="mt-3 text-sm text-slate-300">
                      {selected.conditions || "No additional conditions"}
                    </p>

                    <p className="mt-4 text-sm font-semibold capitalize">
                      {selected.status.replaceAll("_", " ")}
                    </p>
                  </div>

                  <h3 className="mt-9 text-xl font-black">
                    Negotiation History
                  </h3>

                  <div className="mt-5 space-y-3">
                    {history.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-xl border border-white/10 bg-[#0B1628] p-4"
                      >
                        <div className="flex flex-wrap justify-between gap-2">
                          <p className="text-sm font-bold">
                            {event.actor_name}
                          </p>

                          <span className="text-xs capitalize text-blue-300">
                            {event.action}
                          </span>
                        </div>

                        <p className="mt-2 font-bold">
                          {money(event.amount_nzd)}
                        </p>

                        {event.conditions && (
                          <p className="mt-1 text-xs text-slate-400">
                            {event.conditions}
                          </p>
                        )}

                        <p className="mt-2 text-xs text-slate-500">
                          {new Date(
                            event.created_at
                          ).toLocaleString("en-NZ")}
                        </p>
                      </div>
                    ))}
                  </div>

                  {myTurn && (
                    <div className="mt-9 border-t border-white/10 pt-7">
                      <h3 className="text-xl font-black">
                        Your Decision
                      </h3>

                      <p className="mt-2 text-sm text-slate-400">
                        Accept these terms, decline, or propose a counteroffer.
                      </p>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void act("accept")}
                          className="rounded-xl bg-green-700 px-5 py-3 font-bold hover:bg-green-600 disabled:opacity-50"
                        >
                          Accept Offer
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void act("decline")}
                          className="rounded-xl border border-red-400/30 px-5 py-3 font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          Decline Offer
                        </button>
                      </div>

                      <div className="mt-7 rounded-xl border border-white/10 bg-[#0B1628] p-5">
                        <label
                          htmlFor="counter-price"
                          className="block text-sm font-semibold"
                        >
                          Your Counteroffer (NZD)
                        </label>

                        <input
                          id="counter-price"
                          type="number"
                          min="1"
                          step="1"
                          value={counterAmount}
                          onChange={(e) =>
                            setCounterAmount(e.target.value)
                          }
                          className="mt-3 w-full rounded-lg border border-white/15 bg-[#14253D] px-4 py-3"
                        />

                        <label
                          htmlFor="counter-conditions"
                          className="mt-5 block text-sm font-semibold"
                        >
                          Conditions
                        </label>

                        <textarea
                          id="counter-conditions"
                          rows={3}
                          maxLength={1000}
                          value={conditions}
                          onChange={(e) =>
                            setConditions(e.target.value)
                          }
                          className="mt-3 w-full rounded-lg border border-white/15 bg-[#14253D] px-4 py-3"
                        />

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void act("counter")}
                          className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3 font-bold hover:bg-blue-500 disabled:opacity-50"
                        >
                          Send Counteroffer
                        </button>
                      </div>
                    </div>
                  )}

                  {canWithdraw && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void act("withdraw")}
                      className="mt-6 text-sm font-semibold text-red-300 hover:underline disabled:opacity-50"
                    >
                      Withdraw your pending offer
                    </button>
                  )}

                  {!myTurn && !terminal && (
                    <p className="mt-7 rounded-xl bg-[#0B1628] p-4 text-sm text-slate-300">
                      Waiting for {otherName} to respond.
                    </p>
                  )}

                  {selected.status === "accepted" && (
                    <p className="mt-7 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-sm text-green-200">
                      Terms agreed in principle. Inspection,
                      payment and ownership transfer still need
                      to be arranged separately.
                    </p>
                  )}

                  {(selected.status === "declined" ||
                    selected.status === "withdrawn") && (
                    <p className="mt-7 rounded-xl bg-[#0B1628] p-4 text-sm text-slate-300">
                      This negotiation is closed.
                    </p>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
