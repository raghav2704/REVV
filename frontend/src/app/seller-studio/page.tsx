
"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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

type Offer = {
  id: number;
  vehicle_id: number;
  buyer_id: number;
  seller_id: number;
  buyer_name: string;
  seller_name: string;
  current_amount_nzd: number;
  conditions: string;
  status: string;
  updated_at: string;
};

type Account = {
  id: number;
  full_name: string;
};

function money(amount: number) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function dateLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
  });
}

<Link
  href={`/offers?offer=${offer.id}`}
  className="mt-5 block rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold transition hover:bg-blue-500"
>
  Review Offer →
</Link>

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Please sign in to access Seller Studio."
        : typeof data?.detail === "string"
          ? data.detail
          : `Unable to load data (${response.status}).`
    );
  }

  return data as T;
}

function StatCard({
  label,
  value,
  description,
  highlight = false,
}: {
  label: string;
  value: number;
  description: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 transition ${
        highlight && value > 0
          ? "border-blue-500/35 bg-blue-500/10"
          : "border-white/10 bg-[#111E32]"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-4 text-3xl font-black tracking-tight ${
          highlight && value > 0
            ? "text-blue-300"
            : "text-white"
        }`}
      >
        {value.toLocaleString("en-NZ")}
      </p>

      <p className="mt-2 text-xs leading-5 text-slate-400">
        {description}
      </p>
    </div>
  );
}

export default function SellerStudioPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "all" | "active" | "attention"
  >("all");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async (initial = false) => {
    if (!initial) setRefreshing(true);

    try {
      const results = await Promise.all([
        getJson<Account | { data: Account }>(
          "/api/v1/auth/me"
        ),
        getJson<Overview>(
          "/api/v1/deals/seller/overview"
        ),
        getJson<{ data: Offer[] }>(
          "/api/v1/deals/offers"
        ),
      ]);

      const [auth, overviewData, offersData] = results;
      const user = "data" in auth ? auth.data : auth;

      if (
        !user ||
        !Number.isInteger(user.id) ||
        !Array.isArray(overviewData.listings) ||
        !Array.isArray(offersData.data)
      ) {
        throw new Error("Invalid Seller Studio response.");
      }

      setAccount(user);
      setOverview(overviewData);

      // Only display offers for vehicles owned by this account.
      setOffers(
        offersData.data.filter(
          (offer) => offer.seller_id === user.id
        )
      );

      setUpdatedAt(new Date());
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load Seller Studio."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh(true);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 15000);

    return () => window.clearInterval(interval);
  }, [refresh]);

  const listings = useMemo(() => {
    const all = overview?.listings ?? [];

    return all.filter((listing) => {
      const title =
        `${listing.year} ${listing.make} ${listing.model}`.toLowerCase();

      const matchesSearch = title.includes(
        search.trim().toLowerCase()
      );

      const needsAction =
        Number(listing.offers_awaiting_you) > 0 ||
        Number(listing.unread_messages) > 0;

      const matchesFilter =
        filter === "all" ||
        (filter === "active" &&
          listing.listing_status === "active") ||
        (filter === "attention" && needsAction);

      return matchesSearch && matchesFilter;
    });
  }, [overview, search, filter]);

  const pendingOffers = useMemo(
    () =>
      offers
        .filter((offer) => offer.status === "pending_seller")
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime()
        ),
    [offers]
  );

  const totals = overview?.totals;

  const attentionCount =
    Number(totals?.offers_awaiting_you ?? 0) +
    Number(totals?.unread_messages ?? 0);

  const activeCount =
    overview?.listings.filter(
      (listing) => listing.listing_status === "active"
    ).length ?? 0;

  return (
    <main className="min-h-screen bg-[#080F1C] px-4 py-9 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/my-listings"
              className="text-sm font-semibold text-blue-300 transition hover:text-white"
            >
              ← My Listings
            </Link>

            <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.2em] text-blue-400">
              REVV / SELLER STUDIO
            </p>

            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Your Garage
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Track buyer interest, manage your listings and
              stay on top of negotiations.
            </p>
          </div>

          <Link
            href="/sell"
            className="rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold transition hover:bg-blue-500"
          >
            + List a Vehicle
          </Link>
        </div>

        {/* REFRESH / ACCOUNT */}

        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold">
              {account?.full_name?.charAt(0)?.toUpperCase() ||
                "R"}
            </div>

            <div>
              <p className="text-sm font-bold">
                {account?.full_name || "REVV Seller"}
              </p>

              <p className="text-xs text-slate-400">
                {activeCount} active listings
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={refreshing}
            onClick={() => void refresh()}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10 disabled:opacity-50"
          >
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#111E32] p-12 text-center text-slate-400">
            Loading Seller Studio...
          </div>
        ) : !overview ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#111E32] p-8">
            <p className="font-semibold">
              Seller Studio couldn't load.
            </p>

            <Link
              href="/login"
              className="mt-4 inline-block text-sm text-blue-300 hover:underline"
            >
              Sign in to REVV
            </Link>
          </div>
        ) : (
          <>
            {/* PERFORMANCE OVERVIEW */}

            <section className="mt-9">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black sm:text-2xl">
                    Performance Overview
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    Live metrics across your listed vehicles.
                  </p>
                </div>

                {updatedAt && (
                  <p className="text-xs text-slate-500">
                    Updated{" "}
                    {updatedAt.toLocaleTimeString("en-NZ", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <StatCard
                  label="Listing Views"
                  value={Number(totals?.views ?? 0)}
                  description="Signed-in daily views"
                />

                <StatCard
                  label="Watchlist Saves"
                  value={Number(totals?.watchers ?? 0)}
                  description="Current saved listings"
                />

                <StatCard
                  label="Negotiations"
                  value={Number(totals?.offers ?? 0)}
                  description="Offers received"
                />

                <StatCard
                  label="Offers to Review"
                  value={Number(
                    totals?.offers_awaiting_you ?? 0
                  )}
                  description="Your response needed"
                  highlight
                />

                <StatCard
                  label="Unread Messages"
                  value={Number(
                    totals?.unread_messages ?? 0
                  )}
                  description="New buyer messages"
                  highlight
                />
              </div>
            </section>

            {/* ATTENTION CENTER */}

            <section className="mt-9 rounded-2xl border border-blue-500/20 bg-[#111E32] p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-wider text-blue-400">
                    SELLER ACTIVITY
                  </p>

                  <h2 className="mt-2 text-xl font-black sm:text-2xl">
                    Needs Your Attention
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    Offers awaiting your response and unread
                    messages from buyers.
                  </p>
                </div>

                {attentionCount > 0 && (
                  <span className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-bold">
                    {attentionCount} outstanding
                  </span>
                )}
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Link
                  href="/offers"
                  className="rounded-xl border border-white/10 bg-[#0B192D] p-5 transition hover:border-blue-400/40 hover:bg-[#152943]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">🤝</span>
                    <span className="text-2xl font-black text-blue-300">
                      {totals?.offers_awaiting_you ?? 0}
                    </span>
                  </div>

                  <p className="mt-4 font-bold">
                    Review Offers
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Accept, decline or negotiate a counteroffer.
                  </p>
                </Link>

                <Link
                  href="/messages"
                  className="rounded-xl border border-white/10 bg-[#0B192D] p-5 transition hover:border-blue-400/40 hover:bg-[#152943]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">💬</span>
                    <span className="text-2xl font-black text-blue-300">
                      {totals?.unread_messages ?? 0}
                    </span>
                  </div>

                  <p className="mt-4 font-bold">
                    Buyer Messages
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    Reply to enquiries and arrange vehicle viewings.
                  </p>
                </Link>
              </div>

              {attentionCount === 0 && (
                <p className="mt-5 text-sm text-emerald-300">
                  ✓ You're all caught up.
                </p>
              )}
            </section>

            {/* RECENT OFFERS */}

            <section className="mt-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black sm:text-2xl">
                    Offers Awaiting Response
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    Current buyer proposals.
                  </p>
                </div>

                <Link
                  href="/offers"
                  className="text-sm font-bold text-blue-300 hover:text-white"
                >
                  Open Deal Room →
                </Link>
              </div>

              {pendingOffers.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-[#111E32] p-7">
                  <p className="text-sm text-slate-400">
                    No offers are currently awaiting your response.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {pendingOffers.slice(0, 4).map((offer) => {
                    const vehicle = overview.listings.find(
                      (listing) =>
                        listing.vehicle_id === offer.vehicle_id
                    );

                    return (
                      <div
                        key={offer.id}
                        className="rounded-2xl border border-white/10 bg-[#111E32] p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-blue-300">
                              NEW PROPOSAL
                            </p>

                            <h3 className="mt-2 font-bold">
                              {vehicle
                                ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`
                                : `Vehicle #${offer.vehicle_id}`}
                            </h3>
                          </div>

                          <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-semibold text-blue-200">
                            Pending
                          </span>
                        </div>

                        <p className="mt-4 text-3xl font-black">
                          {money(offer.current_amount_nzd)}
                        </p>

                        <p className="mt-2 text-sm text-slate-400">
                          From {offer.buyer_name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Last updated {dateLabel(offer.updated_at)}
                        </p>

                        {offer.conditions && (
                          <p className="mt-4 line-clamp-2 text-xs leading-5 text-slate-400">
                            {offer.conditions}
                          </p>
                        )}

                        <Link
                          href="/offers"
                          className="mt-5 block rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold transition hover:bg-blue-500"
                        >
                          Review in Deal Room
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* MY VEHICLES */}

            <section className="mt-11">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black sm:text-2xl">
                    Your Vehicles
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    Listing performance and buyer interest.
                  </p>
                </div>

                <Link
                  href="/my-listings"
                  className="text-sm font-bold text-blue-300 hover:text-white"
                >
                  Manage Listings →
                </Link>
              </div>

              {/* FILTERS */}

              <div className="mt-6 flex flex-wrap gap-3">
                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search your vehicles..."
                  aria-label="Search your vehicles"
                  className="min-w-[190px] flex-1 rounded-xl border border-white/10 bg-[#111E32] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
                />

                <select
                  value={filter}
                  onChange={(event) =>
                    setFilter(
                      event.target.value as
                        | "all"
                        | "active"
                        | "attention"
                    )
                  }
                  aria-label="Filter vehicle listings"
                  className="rounded-xl border border-white/10 bg-[#111E32] px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                >
                  <option value="all">All Listings</option>
                  <option value="active">Active</option>
                  <option value="attention">Needs Attention</option>
                </select>
              </div>

              {listings.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-[#111E32] p-10 text-center">
                  <p className="text-3xl">🚘</p>

                  <h3 className="mt-4 font-bold">
                    No matching vehicles
                  </h3>

                  <p className="mt-2 text-sm text-slate-400">
                    Try another search or manage your listings.
                  </p>

                  <Link
                    href="/my-listings"
                    className="mt-5 inline-block text-sm font-bold text-blue-300"
                  >
                    Go to My Listings →
                  </Link>
                </div>
              ) : (
                <div className="mt-5 grid gap-4">
                  {listings.map((listing) => {
                    const needsAction =
                      Number(listing.offers_awaiting_you) +
                      Number(listing.unread_messages);

                    return (
                      <article
                        key={listing.vehicle_id}
                        className="overflow-hidden rounded-2xl border border-white/10 bg-[#111E32] transition hover:border-blue-500/30"
                      >
                        <div className="p-5 sm:p-7">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    listing.listing_status ===
                                    "active"
                                      ? "bg-emerald-500/10 text-emerald-300"
                                      : "bg-white/10 text-slate-300"
                                  }`}
                                >
                                  {listing.listing_status}
                                </span>

                                {needsAction > 0 && (
                                  <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-200">
                                    {needsAction} needs attention
                                  </span>
                                )}
                              </div>

                              <h3 className="mt-4 text-xl font-black">
                                {listing.year} {listing.make}{" "}
                                {listing.model}
                              </h3>

                              <p className="mt-2 text-lg font-bold text-blue-300">
                                {money(listing.price_nzd)}
                              </p>
                            </div>

                            <Link
                              href={`/cars/${listing.vehicle_id}`}
                              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10"
                            >
                              View Listing ↗
                            </Link>
                          </div>

                          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/10 pt-6 sm:grid-cols-4">
                            {[
                              {
                                label: "Views",
                                value: listing.views,
                              },
                              {
                                label: "Watchers",
                                value: listing.watchers,
                              },
                              {
                                label: "Offers",
                                value: listing.total_offers,
                              },
                              {
                                label: "Unread",
                                value: listing.unread_messages,
                              },
                            ].map((item) => (
                              <div
                                key={item.label}
                                className="rounded-xl bg-[#0C192C] p-4"
                              >
                                <p className="text-xs text-slate-400">
                                  {item.label}
                                </p>

                                <p className="mt-2 text-2xl font-black">
                                  {Number(item.value).toLocaleString(
                                    "en-NZ"
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>

                          <div className="mt-6 flex flex-wrap gap-3">
                            <Link
                              href="/offers"
                              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold transition hover:bg-blue-500"
                            >
                              Offers
                              {Number(
                                listing.offers_awaiting_you
                              ) > 0 &&
                                ` (${listing.offers_awaiting_you})`}
                            </Link>

                            <Link
                              href="/messages"
                              className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold transition hover:bg-white/10"
                            >
                              Messages
                              {Number(
                                listing.unread_messages
                              ) > 0 &&
                                ` (${listing.unread_messages})`}
                            </Link>

                            <Link
                              href="/my-listings"
                              className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold transition hover:bg-white/10"
                            >
                              Manage Vehicle
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <p className="mt-10 text-xs leading-6 text-slate-500">
              REVV currently counts unique signed-in visitors per
              vehicle per NZ calendar day. Views are not total
              page impressions. Watchers are active watchlist
              saves, and negotiations are existing offer threads.
              Stats refresh approximately every 15 seconds while
              this page is visible.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
