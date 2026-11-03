
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API = typeof window === "undefined" ? "http://127.0.0.1:8000" : window.location.origin;

type Props = {
  vehicleId: number;
  askingPrice: number;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);

export default function VehicleDealActions({
  vehicleId,
  askingPrice,
}: Props) {
  const [watched, setWatched] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [amount, setAmount] = useState(
    Math.max(1, Math.round(askingPrice))
  );
  const [conditions, setConditions] = useState(
    "Subject to vehicle inspection"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const me = await fetch(`${API}/api/v1/auth/me`, {
          credentials: "include",
          cache: "no-store",
        });

        if (!active || !me.ok) return;
        setAuthenticated(true);

        const state = await fetch(
          `${API}/api/v1/deals/vehicles/${vehicleId}/watchlist`,
          { credentials: "include" }
        );

        if (state.ok) {
          const data = await state.json();
          if (active) setWatched(Boolean(data.watched));
        }

        // Counts at most once per user, car and NZ day.
        await fetch(
          `${API}/api/v1/deals/vehicles/${vehicleId}/view`,
          {
            method: "POST",
            credentials: "include",
          }
        );
      } catch {
        // Page remains usable if analytics is unavailable.
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, [vehicleId]);

  async function toggleWatchlist() {
    if (busy) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API}/api/v1/deals/vehicles/${vehicleId}/watchlist`,
        {
          method: watched ? "DELETE" : "POST",
          credentials: "include",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Could not update watchlist"
        );
      }

      setWatched(Boolean(data.watched));
      setSuccess(
        data.watched
          ? "Saved to your watchlist."
          : "Removed from your watchlist."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Request failed"
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitOffer() {
    if (busy || !Number.isInteger(amount) || amount <= 0) {
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API}/api/v1/deals/vehicles/${vehicleId}/offers`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount_nzd: amount,
            conditions,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Could not submit offer"
        );
      }

      setOfferOpen(false);
      setSuccess(
        `Your offer of ${money(amount)} has been sent to the seller.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Request failed"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {!authenticated ? (
        <Link
          href="/login"
          className="block rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-3.5 text-center font-bold text-blue-200 hover:bg-blue-500/20"
        >
          Sign in to save or make an offer
        </Link>
      ) : (
        <>
          <button
            type="button"
            onClick={() => void toggleWatchlist()}
            disabled={busy}
            className="w-full rounded-xl border border-blue-400/30 bg-blue-500/10 px-5 py-3.5 font-bold text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-50"
          >
            {watched ? "♥ Saved to Watchlist" : "♡ Save to Watchlist"}
          </button>

          <button
            type="button"
            onClick={() => setOfferOpen(!offerOpen)}
            className="w-full rounded-xl bg-blue-600 px-5 py-3.5 font-bold text-white transition hover:bg-blue-500"
          >
            {offerOpen ? "Close Deal Room" : "Make an Offer"}
          </button>

          {offerOpen && (
            <div className="space-y-4 rounded-2xl border border-blue-400/20 bg-[#14253D] p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-blue-300">
                  REVV DEAL ROOM
                </p>
                <h3 className="mt-2 text-xl font-black">
                  Your Proposal
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  Asking price: {money(askingPrice)}
                </p>
              </div>

              <div>
                <label
                  htmlFor="deal-price"
                  className="mb-2 block text-sm font-semibold"
                >
                  Offer amount (NZD)
                </label>
                <input
                  id="deal-price"
                  type="number"
                  min={1}
                  max={100000000}
                  step={1}
                  value={amount}
                  onChange={(e) =>
                    setAmount(Number(e.target.value))
                  }
                  className="w-full rounded-xl border border-white/15 bg-[#0B1628] px-4 py-3 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="deal-conditions"
                  className="mb-2 block text-sm font-semibold"
                >
                  Offer conditions
                </label>

                <select
                  id="deal-conditions"
                  value={conditions}
                  onChange={(e) =>
                    setConditions(e.target.value)
                  }
                  className="w-full rounded-xl border border-white/15 bg-[#0B1628] px-4 py-3 text-white"
                >
                  <option value="Subject to vehicle inspection">
                    Subject to vehicle inspection
                  </option>
                  <option value="Subject to finance approval">
                    Subject to finance approval
                  </option>
                  <option value="Subject to inspection and finance">
                    Subject to inspection and finance
                  </option>
                  <option value="No additional conditions">
                    No additional conditions
                  </option>
                </select>
              </div>

              <p className="text-xs leading-5 text-slate-400">
                The seller can accept, decline or counter.
                Acceptance records agreement in principle,
                not a completed vehicle sale.
              </p>

              <button
                type="button"
                onClick={() => void submitOffer()}
                disabled={busy || amount <= 0 || !Number.isInteger(amount)}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-bold transition hover:bg-blue-500 disabled:opacity-50"
              >
                {busy ? "Submitting..." : `Send ${money(amount)} Offer`}
              </button>
            </div>
          )}
        </>
      )}

      {success && (
        <p role="status" className="text-sm text-green-300">
          {success}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
