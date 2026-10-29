
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

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

type Photo = {
  id: number;
  url: string;
  is_cover: boolean;
  position: number;
};

type Listing = Vehicle & {
  coverUrl: string | null;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);
}

function extractCars(data: unknown): Vehicle[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === "object") {
    const response = data as Record<string, unknown>;

    for (const key of ["cars", "vehicles", "items", "listings"]) {
      if (Array.isArray(response[key])) {
        return response[key] as Vehicle[];
      }
    }
  }

  throw new Error(
    "Unexpected listings response from the server. Check the API response."
  );
}

export default function MyListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(
    null
  );

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/v1/my/cars`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        throw new Error(
          "Your session has expired. Please log in again."
        );
      }

      if (response.status === 403) {
        throw new Error(
          "You do not have permission to view these listings."
        );
      }

      if (!response.ok) {
        throw new Error(
          `Unable to load your listings (${response.status}).`
        );
      }

      const data: unknown = await response.json();
      const cars = extractCars(data);

      const withImages: Listing[] = await Promise.all(
        cars.map(async (car) => {
          let coverUrl: string | null = null;

          try {
            const photoResponse = await fetch(
              `${API}/api/v1/cars/${car.id}/images`,
              {
                cache: "no-store",
              }
            );

            if (photoResponse.ok) {
              const gallery: {
                images?: Photo[];
              } = await photoResponse.json();

              const photos = Array.isArray(gallery.images)
                ? [...gallery.images]
                : [];

              photos.sort(
                (a, b) =>
                  a.position - b.position || a.id - b.id
              );

              const cover =
                photos.find((photo) => photo.is_cover) ??
                photos[0];

              if (cover) {
                coverUrl = new URL(
                  cover.url,
                  API
                ).toString();
              }
            }
          } catch (photoError) {
            console.warn(
              `Failed to load photos for vehicle ${car.id}:`,
              photoError
            );
          }

          return {
            ...car,
            coverUrl,
          };
        })
      );

      setListings(withImages);
    } catch (err) {
      console.error("Failed to load My Listings:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your listings."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  async function deleteListing(car: Listing) {
    if (deletingId !== null) return;

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete your ${car.year} ${car.make} ${car.model}?`
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

      if (response.status === 401) {
        throw new Error(
          "Your session has expired. Please log in again."
        );
      }

      if (response.status === 403) {
        throw new Error(
          "You do not have permission to delete this listing."
        );
      }

      if (!response.ok) {
        throw new Error(
          `Could not delete listing (${response.status}).`
        );
      }

      setListings((current) =>
        current.filter((listing) => listing.id !== car.id)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete your listing."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#080e18] px-5 py-14 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
              REVV / SELLER DASHBOARD
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
              My Listings
            </h1>

            <p className="mt-3 text-zinc-400">
              Manage your cars, edit information, upload photos
              and keep track of your listings.
            </p>
          </div>

          <Link
            href="/sell"
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-500"
          >
            + Sell Another Car
          </Link>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-300"
          >
            <p className="font-semibold">
              Could not load listings
            </p>
            <p className="mt-2 text-sm">{error}</p>

            <button
              type="button"
              onClick={() => void loadListings()}
              className="mt-4 rounded-lg border border-red-400/30 px-4 py-2 text-sm font-semibold hover:bg-red-500/10"
            >
              Try Again
            </button>
          </div>
        )}

        {loading ? (
          <div className="mt-12 rounded-2xl border border-white/10 bg-[#101a2a] p-12 text-center text-zinc-400">
            Loading your listings...
          </div>
        ) : error && listings.length === 0 ? null : listings.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-white/10 bg-[#101a2a] px-8 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/15 text-3xl">
              🚗
            </div>

            <h2 className="mt-6 text-2xl font-bold">
              No listings yet
            </h2>

            <p className="mx-auto mt-3 max-w-md text-zinc-400">
              You haven't listed any cars on REVV yet.
              Create your first listing to get started.
            </p>

            <Link
              href="/sell"
              className="mt-7 inline-block rounded-xl bg-blue-600 px-7 py-3 font-semibold hover:bg-blue-500"
            >
              Create Your First Listing
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-9 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-zinc-400">
                {listings.length}{" "}
                {listings.length === 1
                  ? "vehicle listing"
                  : "vehicle listings"}
              </p>

              <button
                type="button"
                onClick={() => void loadListings()}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium hover:bg-white/10"
              >
                Refresh Listings
              </button>
            </div>

            <div className="mt-5 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {listings.map((car) => (
                <article
                  key={car.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-[#101a2a] transition hover:border-blue-500/40"
                >
                  <div className="relative h-52 bg-[#172438]">
                    {car.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={car.coverUrl}
                        alt={`${car.year} ${car.make} ${car.model}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-500">
                        <span className="text-4xl">🚘</span>
                        <span className="text-sm">
                          No vehicle photos
                        </span>
                      </div>
                    )}

                    <span className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                      Listing #{car.id}
                    </span>
                  </div>

                  <div className="p-5">
                    <h2 className="text-xl font-bold">
                      {car.year} {car.make} {car.model}
                    </h2>

                    <p className="mt-3 text-2xl font-black text-blue-400">
                      {formatPrice(car.price_nzd)}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 text-sm text-zinc-400">
                      <span>
                        {Number(car.mileage_km).toLocaleString("en-NZ")} km
                      </span>
                      <span>•</span>
                      <span>{car.location}</span>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <Link
                        href={`/cars/${car.id}`}
                        className="rounded-lg border border-white/15 px-4 py-3 text-center text-sm font-semibold transition hover:bg-white/10"
                      >
                        View Listing
                      </Link>

                      <Link
                        href={`/my-listings/${car.id}/edit`}
                        className="rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold transition hover:bg-blue-500"
                      >
                        Edit Listing
                      </Link>
                    </div>

                    <button
                      type="button"
                      disabled={deletingId !== null}
                      onClick={() => void deleteListing(car)}
                      className="mt-3 w-full rounded-lg border border-red-500/30 px-4 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {deletingId === car.id
                        ? "Deleting..."
                        : "Delete Listing"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
