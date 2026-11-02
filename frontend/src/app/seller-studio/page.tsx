
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

type Listing = {
  vehicle_id: number;
  year: number;
  make: string;
  model: string;
  price_nzd: number;
  listing_status: string;
  views: number;
  watchers: number;
  total_offers: number;
  offers_awaiting_you: number;
  unread_messages: number;
};

type Overview = {
  listings: Listing[];
  totals: {
    views: number;
    watchers: number;
    offers: number;
    offers_awaiting_you: number;
    unread_messages: number;
  };
};

export default function SellerStudio() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch(
          `${API}/api/v1/deals/seller/overview`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Please sign in to access Seller Studio."
              : "Unable to load seller analytics."
          );
        }

        if (active) {
          setOverview(data);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Request failed"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void refresh();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 15000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const totals = overview?.totals;

  const stats = [
    { label: "Listing views", value: totals?.views ?? 0 },
    { label: "Watchlist saves", value: totals?.watchers ?? 0 },
    { label: "Negotiations", value: totals?.offers ?? 0 },
    {
      label: "Offers requiring action",
      value: totals?.offers_awaiting_you ?? 0,
    },
    {
      label: "Unread messages",
      value: totals?.unread_messages ?? 0,
    },
  ];

  return (
    <main className="min-h-screen bg-[#080F1C] px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/my-listings"
          className="text-sm font-semibold text-blue-300"
        >
          ← My Listings
        </Link>

        <p className="mt-9 text-xs font-bold uppercase tracking-widest text-blue-400">
          REVV / SELLER STUDIO
        </p>

        <h1 className="mt-2 text-4xl font-black">
          Your Selling Performance
        </h1>

        <p className="mt-3 text-slate-400">
          Understand your listings, track interest and respond
          to potential buyers.
        </p>

        {error && (
          <p role="alert" className="mt-5 text-red-300">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-8 text-slate-400">
            Loading your dashboard...
          </p>
        ) : overview ? (
          <>
            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/10 bg-[#111E32] p-5"
                >
                  <p className="text-sm text-slate-400">
                    {stat.label}
                  </p>

                  <p className="mt-4 text-3xl font-black text-blue-300">
                    {stat.value.toLocaleString("en-NZ")}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/offers"
                className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold hover:bg-blue-500"
              >
                Review Offers
                {(totals?.offers_awaiting_you ?? 0) > 0 &&
                  ` (${totals?.offers_awaiting_you})`}
              </Link>

              <Link
                href="/messages"
                className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white/10"
              >
                View Messages
                {(totals?.unread_messages ?? 0) > 0 &&
                  ` (${totals?.unread_messages})`}
              </Link>
            </div>

            <section className="mt-10">
              <h2 className="text-2xl font-black">
                Listing Performance
              </h2>

              {overview.listings.length === 0 ? (
                <p className="mt-5 rounded-2xl bg-[#111E32] p-8 text-slate-400">
                  You don't have any listings assigned to your account yet.
                </p>
              ) : (
                <div className="mt-5 grid gap-4">
                  {overview.listings.map((listing) => (
                    <article
                      key={listing.vehicle_id}
                      className="rounded-2xl border border-white/10 bg-[#111E32] p-6"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
                            {listing.listing_status}
                          </p>

                          <h3 className="mt-2 text-xl font-black">
                            {listing.year} {listing.make}{" "}
                            {listing.model}
                          </h3>

                          <Link
                            href={`/cars/${listing.vehicle_id}`}
                            className="mt-2 inline-block text-sm text-blue-300 hover:underline"
                          >
                            View listing →
                          </Link>
                        </div>

                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                          <div>
                            <p className="text-slate-400">Views</p>
                            <p className="mt-1 text-xl font-bold">
                              {listing.views}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-400">Watchers</p>
                            <p className="mt-1 text-xl font-bold">
                              {listing.watchers}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-400">Offers</p>
                            <p className="mt-1 text-xl font-bold">
                              {listing.total_offers}
                            </p>
                          </div>

                          <div>
                            <p className="text-slate-400">Needs action</p>
                            <p className="mt-1 text-xl font-bold text-blue-300">
                              {listing.offers_awaiting_you +
                                listing.unread_messages}
                            </p>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <p className="mt-8 text-xs leading-6 text-slate-500">
              Views currently count unique signed-in viewers per
              NZ calendar day, excluding your own visits.
              Anonymous visitors are not included.
            </p>
          </>
        ) : null}
      </div>
    </main>
  );
}
