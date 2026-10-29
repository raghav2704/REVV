
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
  cover?: string;
};

export default function MyListingsPage() {
  const [cars, setCars] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadCars = useCallback(async () => {
    try {
      setError("");

      const response = await fetch(`${API}/api/v1/cars`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load listings.");
      }

      const result: { data: Vehicle[] } =
        await response.json();

      const vehicles = await Promise.all(
        result.data.map(async (car) => {
          try {
            const imageResponse = await fetch(
              `${API}/api/v1/cars/${car.id}/images`,
              { cache: "no-store" }
            );

            if (!imageResponse.ok) return car;

            const imageData: {
              images: {
                url: string;
                is_cover: boolean;
              }[];
            } = await imageResponse.json();

            const cover =
              imageData.images.find(
                (image) => image.is_cover
              ) ?? imageData.images[0];

            return {
              ...car,
              cover: cover
                ? `${API}${cover.url}`
                : undefined,
            };
          } catch {
            return car;
          }
        })
      );

      setCars(vehicles);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCars();
  }, [loadCars]);

  async function deleteVehicle(car: Vehicle) {
    if (deleting !== null) return;

    const confirmed = window.confirm(
      `Permanently delete ${car.year} ${car.make} ${car.model}?\n\nThis will also delete its uploaded photos.`
    );

    if (!confirmed) return;

    setDeleting(car.id);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/v1/cars/${car.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to delete this listing."
        );
      }

      setCars((current) =>
        current.filter((item) => item.id !== car.id)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Deletion failed."
      );
    } finally {
      setDeleting(null);
    }
  }

  const currency = (value: number) =>
    new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <main className="min-h-screen bg-[#f4f6f9] text-zinc-900">
      <section className="bg-[#0b1321] px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
            REVV / LISTING MANAGEMENT
          </p>

          <h1 className="mt-4 text-4xl font-black md:text-5xl">
            Development Listings
          </h1>

          <p className="mt-4 max-w-xl text-zinc-400">
            View, edit and manage the vehicles stored
            in your REVV development database.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sell"
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500"
            >
              + Create Listing
            </Link>

            <Link
              href="/#explore"
              className="rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold hover:bg-white/10"
            >
              Explore Marketplace
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              Vehicle Inventory
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {cars.length} vehicles in development
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void loadCars();
            }}
            className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-zinc-100"
          >
            Refresh Listings
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-xl bg-white p-12 text-center text-zinc-500">
            Loading REVV listings...
          </div>
        ) : cars.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
            <h3 className="text-xl font-bold">
              No listings found
            </h3>

            <p className="mt-2 text-zinc-500">
              Create a vehicle to get started.
            </p>

            <Link
              href="/sell"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white"
            >
              Create Listing
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {cars.map((car) => (
              <article
                key={car.id}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
              >
                <div className="h-52 bg-zinc-100">
                  {car.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={car.cover}
                      alt={`${car.year} ${car.make} ${car.model}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                      No vehicle photo
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                    Listing #{car.id}
                  </p>

                  <h3 className="mt-3 text-xl font-bold">
                    {car.year} {car.make} {car.model}
                  </h3>

                  <p className="mt-3 text-2xl font-bold text-blue-600">
                    {currency(car.price_nzd)}
                  </p>

                  <p className="mt-3 text-sm text-zinc-500">
                    {car.mileage_km.toLocaleString("en-NZ")} km
                    {" · "}
                    {car.location}
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-2">
                    <Link
                      href={`/cars/${car.id}`}
                      className="rounded-lg border border-zinc-200 px-4 py-3 text-center text-sm font-semibold hover:bg-zinc-50"
                    >
                      View
                    </Link>

                    <Link
                      href={`/my-listings/${car.id}/edit`}
                      className="rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-blue-500"
                    >
                      Edit
                    </Link>
                  </div>

                  <button
                    type="button"
                    disabled={deleting !== null}
                    onClick={() => void deleteVehicle(car)}
                    className="mt-3 w-full rounded-lg border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleting === car.id
                      ? "Deleting..."
                      : "Delete Listing"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="mt-10 text-xs text-zinc-500">
          Development access only. All database
          listings are visible here until seller
          authentication and ownership checks are added.
        </p>
      </section>
    </main>
  );
}
