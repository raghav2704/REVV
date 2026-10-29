
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

type Car = {
  id: number;
  make: string;
  model: string;
  year: number;
  price_nzd: number;
  mileage_km: number;
  location: string;
  owner_id: number | null;
  cover?: string;
};

export default function MyListingsPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);

  const loadCars = useCallback(async () => {
    try {
      setError("");
      setUnauthorized(false);

      const response = await fetch(
        `${API}/api/v1/my/cars`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        setUnauthorized(true);
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to load your listings.");
      }

      const result: { data: Car[] } = await response.json();

      const vehicles = await Promise.all(
        result.data.map(async (car) => {
          try {
            const imageResponse = await fetch(
              `${API}/api/v1/cars/${car.id}/images`,
              { cache: "no-store" }
            );

            if (!imageResponse.ok) return car;

            const data: {
              images: {
                url: string;
                is_cover: boolean;
              }[];
            } = await imageResponse.json();

            const cover =
              data.images.find((image) => image.is_cover) ??
              data.images[0];

            return {
              ...car,
              cover: cover ? `${API}${cover.url}` : undefined,
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

  async function deleteCar(car: Car) {
    if (deleting !== null) return;

    const confirmed = window.confirm(
      `Permanently delete ${car.year} ${car.make} ${car.model}?\n\nAll its uploaded photos will also be deleted.`
    );

    if (!confirmed) return;

    setDeleting(car.id);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/v1/cars/${car.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(
            "You don't have permission to delete this car."
          );
        }

        if (response.status === 401) {
          throw new Error(
            "Your session has expired. Please log in again."
          );
        }

        throw new Error("Unable to delete listing.");
      }

      setCars((current) =>
        current.filter((item) => item.id !== car.id)
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Delete failed."
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

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080e18] p-16 text-center text-white">
        Loading your listings...
      </main>
    );
  }

  if (unauthorized) {
    return (
      <main className="min-h-screen bg-[#080e18] px-6 py-20 text-center text-white">
        <h1 className="text-3xl font-black">
          Login Required
        </h1>
        <p className="mt-4 text-zinc-400">
          Sign in to manage your vehicles.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold"
        >
          Sign In
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f6f9] text-zinc-900">
      <section className="bg-[#0b1321] px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
            REVV / SELLER DASHBOARD
          </p>

          <h1 className="mt-4 text-4xl font-black md:text-5xl">
            My Listings
          </h1>

          <p className="mt-4 text-zinc-400">
            Manage your vehicles, pricing and listing details.
          </p>

          <Link
            href="/sell"
            className="mt-8 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold"
          >
            + Sell Another Car
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              Your Vehicles
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {cars.length} listings
            </p>
          </div>

          <button
            onClick={() => {
              setLoading(true);
              void loadCars();
            }}
            className="rounded-lg border bg-white px-5 py-2.5 text-sm font-semibold"
          >
            Refresh
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mb-6 rounded-xl bg-red-50 p-4 text-red-700"
          >
            {error}
          </p>
        )}

        {cars.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center">
            <h3 className="text-2xl font-bold">
              No listings yet
            </h3>
            <p className="mt-3 text-zinc-500">
              Your first vehicle listing will appear here.
            </p>
            <Link
              href="/sell"
              className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-bold text-white"
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
                      alt={`${car.make} ${car.model}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-zinc-400">
                      No Photo
                    </div>
                  )}
                </div>

                <div className="p-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-blue-600">
                    Listing #{car.id}
                  </p>

                  <h3 className="mt-3 text-xl font-bold">
                    {car.year} {car.make} {car.model}
                  </h3>

                  <p className="mt-3 text-2xl font-black text-blue-600">
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
                      className="rounded-lg border px-4 py-3 text-center text-sm font-semibold"
                    >
                      View
                    </Link>

                    <Link
                      href={`/my-listings/${car.id}/edit`}
                      className="rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-semibold text-white"
                    >
                      Edit
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() => void deleteCar(car)}
                    disabled={deleting !== null}
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
      </section>
    </main>
  );
}
