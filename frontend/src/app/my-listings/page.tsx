
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const API = typeof window === "undefined" ? "http://127.0.0.1:8000" : window.location.origin;



type Vehicle = {
  id: number;
  make: string;
  model: string;
  year: number;
  price_nzd: number;
  mileage_km: number;
  location: string;
  owner_id: number | null;
};

type VehicleImage = {
  id: number;
  url: string;
  is_cover: boolean;
  position: number;
};

type Listing = Vehicle & {
  coverUrl: string | null;
  photoCount: number;
};

type SortOption =
  | "newest"
  | "price-low"
  | "price-high"
  | "year-new"
  | "mileage-low";

function money(value: number) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("en-NZ").format(value);
}

function extractCars(response: unknown): Vehicle[] {
  if (
    typeof response === "object" &&
    response !== null &&
    "data" in response &&
    Array.isArray(response.data)
  ) {
    return response.data as Vehicle[];
  }

  throw new Error("The listings API returned an unexpected response.");
}

async function responseError(response: Response) {
  if (response.status === 401) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  if (response.status === 403) {
    throw new Error("You do not have permission to view these listings.");
  }

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
  }
}

<Link
  href="/seller-studio"
  className="inline-flex items-center rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-500"
>
  Open Seller Studio →
</Link>

function StatCard({
  label,
  value,
  subtitle,
  icon,
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111c2e] p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-400">{label}</span>
        <span className="text-xl" aria-hidden="true">
          {icon}
        </span>
      </div>

      <p className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function VehicleCard({
  car,
  deleting,
  onDelete,
}: {
  car: Listing;
  deleting: boolean;
  onDelete: (car: Listing) => void;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/10 bg-[#111c2e] transition hover:border-blue-500/40">
      <Link
        href={`/cars/${car.id}`}
        className="relative block h-52 overflow-hidden bg-[#1a2940]"
        aria-label={`View ${car.year} ${car.make} ${car.model}`}
      >
        {car.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={car.coverUrl}
            alt={`${car.year} ${car.make} ${car.model}`}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
            <span className="text-4xl" aria-hidden="true">
              🚘
            </span>
            <span className="text-sm">No photos uploaded</span>
          </div>
        )}

        <div className="absolute bottom-3 left-3 rounded-lg bg-black/75 px-3 py-1.5 text-xs font-medium text-white">
          Stock #{car.id}
        </div>

        {car.photoCount > 0 && (
          <div className="absolute bottom-3 right-3 rounded-lg bg-black/75 px-3 py-1.5 text-xs text-white">
            📷 {car.photoCount}
          </div>
        )}
      </Link>

      <div className="p-5">
        <h3 className="truncate text-lg font-bold text-white">
          {car.year} {car.make} {car.model}
        </h3>

        <p className="mt-2 text-2xl font-bold text-blue-400">
          {money(car.price_nzd)}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 border-y border-white/10 py-4 text-sm">
          <div>
            <p className="text-xs text-slate-500">Mileage</p>
            <p className="mt-1 font-medium text-slate-200">
              {number(car.mileage_km)} km
            </p>
          </div>

          <div>
            <p className="text-xs text-slate-500">Location</p>
            <p className="mt-1 truncate font-medium text-slate-200">
              {car.location}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link
            href={`/cars/${car.id}`}
            className="rounded-xl border border-white/15 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
          >
            View
          </Link>

          <Link
            href={`/my-listings/${car.id}/edit`}
            className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Edit Listing
          </Link>
        </div>

        <button
          type="button"
          disabled={deleting}
          onClick={() => onDelete(car)}
          className="mt-3 w-full rounded-xl border border-red-500/25 px-4 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete Listing"}
        </button>
      </div>
    </article>
  );
}

export default function MyListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API}/api/v1/my/cars`, {
        credentials: "include",
        cache: "no-store",
      });

      await responseError(response);

      const result: unknown = await response.json();
      const cars = extractCars(result);

      const enriched = await Promise.all(
        cars.map(async (car): Promise<Listing> => {
          let coverUrl: string | null = null;
          let photoCount = 0;

          try {
            const imagesResponse = await fetch(
              `${API}/api/v1/cars/${car.id}/images`,
              { cache: "no-store" }
            );

            if (imagesResponse.ok) {
              const gallery: { images?: VehicleImage[] } =
                await imagesResponse.json();

              const images = Array.isArray(gallery.images)
                ? [...gallery.images]
                : [];

              photoCount = images.length;

              images.sort(
                (a, b) =>
                  a.position - b.position || a.id - b.id
              );

              const cover =
                images.find((image) => image.is_cover) ??
                images[0];

              if (cover) {
                coverUrl = new URL(cover.url, API).toString();
              }
            }
          } catch (photoError) {
            console.warn(
              `Could not load vehicle ${car.id} photos:`,
              photoError
            );
          }

          return { ...car, coverUrl, photoCount };
        })
      );

      setListings(enriched);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your vehicle inventory."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  const stats = useMemo(() => {
    const totalValue = listings.reduce(
      (sum, car) => sum + car.price_nzd,
      0
    );

    const withPhotos = listings.filter(
      (car) => car.photoCount > 0
    ).length;

    return {
      count: listings.length,
      value: totalValue,
      average:
        listings.length > 0
          ? totalValue / listings.length
          : 0,
      withPhotos,
    };
  }, [listings]);

  const visibleListings = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = listings.filter((car) => {
      const searchable = [
        car.make,
        car.model,
        car.location,
        String(car.year),
        String(car.id),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });

    return filtered.sort((a, b) => {
      switch (sort) {
        case "price-low":
          return a.price_nzd - b.price_nzd;
        case "price-high":
          return b.price_nzd - a.price_nzd;
        case "year-new":
          return b.year - a.year || b.id - a.id;
        case "mileage-low":
          return a.mileage_km - b.mileage_km;
        default:
          return b.id - a.id;
      }
    });
  }, [listings, search, sort]);

  async function deleteListing(car: Listing) {
    if (deletingId !== null) return;

    const confirmed = window.confirm(
      `Permanently delete ${car.year} ${car.make} ${car.model}?\n\nThis will remove the listing and its photos. This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(car.id);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/v1/cars/${car.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      await responseError(response);

      setListings((current) =>
        current.filter((item) => item.id !== car.id)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete this listing."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#080f1c] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-400">
              REVV / INVENTORY MANAGEMENT
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
              Your Garage
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
              Your vehicles, all in one place. Manage listings,
              update photos and keep your inventory organised.
            </p>
          </div>

          <Link
            href="/sell"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold transition hover:bg-blue-500"
          >
            + Add Vehicle
          </Link>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-200"
          >
            <p>{error}</p>

            <button
              type="button"
              onClick={() => void loadListings()}
              className="mt-3 font-semibold text-white underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        )}

        <section
          aria-label="Inventory overview"
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <StatCard
            label="Total Listings"
            value={loading ? "—" : number(stats.count)}
            subtitle="Vehicles in your account"
            icon="🚘"
          />
          <StatCard
            label="Total Asking Value"
            value={loading ? "—" : money(stats.value)}
            subtitle="Combined advertised prices"
            icon="💰"
          />
          <StatCard
            label="Average Asking Price"
            value={loading ? "—" : money(stats.average)}
            subtitle="Based on your inventory"
            icon="📊"
          />
          <StatCard
            label="Listings With Photos"
            value={loading ? "—" : `${stats.withPhotos}/${stats.count}`}
            subtitle="Vehicles with uploaded images"
            icon="📷"
          />
        </section>

        <section className="mt-10">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">
                Vehicle Inventory
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Search, organise and manage your listings.
              </p>
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={() => void loadListings()}
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              ↻ Refresh
            </button>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#111c2e] p-4 sm:flex-row">
            <label className="flex-1">
              <span className="mb-2 block text-xs font-medium text-slate-400">
                Search inventory
              </span>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search make, model, location or stock ID..."
                className="w-full rounded-xl border border-white/10 bg-[#0b1424] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500"
              />
            </label>

            <label className="sm:w-56">
              <span className="mb-2 block text-xs font-medium text-slate-400">
                Sort by
              </span>

              <select
                value={sort}
                onChange={(event) =>
                  setSort(event.target.value as SortOption)
                }
                className="w-full rounded-xl border border-white/10 bg-[#0b1424] px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
              >
                <option value="newest">Newest listing</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="year-new">Newest vehicle year</option>
                <option value="mileage-low">Lowest mileage</option>
              </select>
            </label>
          </div>

          {loading ? (
            <div
              role="status"
              className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="animate-pulse overflow-hidden rounded-2xl border border-white/10 bg-[#111c2e]"
                >
                  <div className="h-52 bg-white/5" />
                  <div className="space-y-4 p-5">
                    <div className="h-5 w-2/3 rounded bg-white/10" />
                    <div className="h-7 w-1/2 rounded bg-white/10" />
                    <div className="h-12 rounded bg-white/5" />
                  </div>
                </div>
              ))}
              <span className="sr-only">Loading listings</span>
            </div>
          ) : error && listings.length === 0 ? null : listings.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-[#111c2e] px-6 py-16 text-center">
              <div className="text-5xl" aria-hidden="true">
                🚗
              </div>

              <h3 className="mt-5 text-2xl font-bold">
                Your garage is empty
              </h3>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-400">
                Add your first vehicle and start building your
                REVV inventory.
              </p>

              <Link
                href="/sell"
                className="mt-7 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
              >
                Add Your First Vehicle
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Showing {visibleListings.length} of{" "}
                  {listings.length} vehicles
                </p>
              </div>

              {visibleListings.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-[#111c2e] px-6 py-14 text-center">
                  <h3 className="text-lg font-semibold">
                    No matching vehicles
                  </h3>

                  <p className="mt-2 text-sm text-slate-400">
                    Try another make, model or location.
                  </p>

                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="mt-5 text-sm font-semibold text-blue-400 hover:text-blue-300"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleListings.map((car) => (
                    <VehicleCard
                      key={car.id}
                      car={car}
                      deleting={deletingId !== null}
                      onDelete={deleteListing}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
