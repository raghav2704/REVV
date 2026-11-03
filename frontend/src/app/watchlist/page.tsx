
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API = "";

type SavedVehicle = {
  id: number;
  year: number;
  make: string;
  model: string;
  price_nzd: number;
  mileage_km: number;
  location: string;
  saved_at: string;
};

export default function WatchlistPage() {
  const [cars, setCars] = useState<SavedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch(
          `${API}/api/v1/deals/watchlist`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            response.status === 401
              ? "Please sign in to view your watchlist."
              : "Unable to load watchlist."
          );
        }

        if (active) setCars(data.data ?? []);
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

    void load();
    return () => {
      active = false;
    };
  }, []);

  async function removeCar(id: number) {
    try {
      const response = await fetch(
        `${API}/api/v1/deals/vehicles/${id}/watchlist`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Unable to remove vehicle.");
      }

      setCars((previous) =>
        previous.filter((car) => car.id !== id)
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Request failed"
      );
    }
  }

  const money = (value: number) =>
    new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <main className="min-h-screen bg-[#080F1C] px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/#explore"
          className="text-sm font-semibold text-blue-300"
        >
          ← Explore vehicles
        </Link>

        <p className="mt-9 text-xs font-bold uppercase tracking-widest text-blue-400">
          REVV / YOUR GARAGE
        </p>

        <h1 className="mt-2 text-4xl font-black">
          My Watchlist
        </h1>

        <p className="mt-3 text-slate-400">
          Cars you've saved and want to keep an eye on.
        </p>

        {error && (
          <p role="alert" className="mt-6 text-red-300">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-10 text-slate-400">
            Loading your saved vehicles...
          </p>
        ) : cars.length === 0 ? (
          <div className="mt-9 rounded-3xl border border-white/10 bg-[#111E32] p-12 text-center">
            <p className="text-4xl">♡</p>
            <h2 className="mt-4 text-xl font-bold">
              Your watchlist is empty
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Save vehicles you're interested in to see them here.
            </p>

            <Link
              href="/#explore"
              className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-bold"
            >
              Explore Cars
            </Link>
          </div>
        ) : (
          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cars.map((car) => (
              <article
                key={car.id}
                className="rounded-2xl border border-white/10 bg-[#111E32] p-6"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  SAVED VEHICLE
                </p>

                <h2 className="mt-3 text-xl font-black">
                  {car.year} {car.make} {car.model}
                </h2>

                <p className="mt-4 text-2xl font-black text-blue-300">
                  {money(car.price_nzd)}
                </p>

                <p className="mt-3 text-sm text-slate-400">
                  {car.mileage_km.toLocaleString("en-NZ")} km
                  {" · "}
                  {car.location}
                </p>

                <div className="mt-6 flex gap-3">
                  <Link
                    href={`/cars/${car.id}`}
                    className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold hover:bg-blue-500"
                  >
                    View Car
                  </Link>

                  <button
                    type="button"
                    onClick={() => void removeCar(car.id)}
                    className="rounded-xl border border-white/15 px-4 py-3 text-sm font-bold hover:bg-white/10"
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
