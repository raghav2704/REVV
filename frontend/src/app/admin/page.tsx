
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

export default function AdminPage() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setError("");
      setAuthorized(false);

      const response = await fetch(
        `${API}/api/v1/admin/cars`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      if (response.status === 401) {
        throw new Error("Please log in to access administration.");
      }

      if (response.status === 403) {
        throw new Error(
          "Access denied. Administrator privileges required."
        );
      }

      if (!response.ok) {
        throw new Error("Unable to load admin dashboard.");
      }

      const result: { data: Car[] } = await response.json();

      const enriched = await Promise.all(
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

            const photo =
              imageData.images.find(
                (image) => image.is_cover
              ) ?? imageData.images[0];

            return {
              ...car,
              cover: photo
                ? `${API}${photo.url}`
                : undefined,
            };
          } catch {
            return car;
          }
        })
      );

      setCars(enriched);
      setAuthorized(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to access admin dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function deleteListing(car: Car) {
    if (deleting !== null) return;

    if (
      !window.confirm(
        `ADMIN ACTION\n\nPermanently delete ${car.year} ${car.make} ${car.model} (ID ${car.id}) and its photos?`
      )
    ) {
      return;
    }

    setDeleting(car.id);

    try {
      const response = await fetch(
        `${API}/api/v1/cars/${car.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error(
          response.status === 403
            ? "Administrator permission was denied."
            : "Unable to delete listing."
        );
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

  const currency = (amount: number) =>
    new Intl.NumberFormat("en-NZ", {
      style: "currency",
      currency: "NZD",
      maximumFractionDigits: 0,
    }).format(amount);

  const inventoryValue = cars.reduce(
    (total, car) => total + car.price_nzd,
    0
  );

  const ownedCars = cars.filter(
    (car) => car.owner_id !== null
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080e18] p-16 text-center text-white">
        Checking administrator permissions...
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#080e18] px-6 py-24 text-center text-white">
        <h1 className="text-4xl font-black">
          Administrator Access Required
        </h1>

        <p className="mt-4 text-red-300">
          {error}
        </p>

        <Link
          href="/"
          className="mt-8 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold"
        >
          Return to REVV
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f6f9] text-zinc-900">
      <section className="bg-[#0b1321] px-6 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
            REVV / PLATFORM ADMINISTRATION
          </p>

          <h1 className="mt-4 text-4xl font-black md:text-5xl">
            Admin Dashboard
          </h1>

          <p className="mt-4 max-w-xl text-zinc-400">
            Manage vehicle inventory and monitor activity
            across the REVV marketplace.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sell"
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
            >
              + Add Vehicle
            </Link>

            <Link
              href="/my-listings"
              className="rounded-xl border border-white/20 px-6 py-3 font-semibold"
            >
              My Listings
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Total Listings
            </p>

            <p className="mt-3 text-4xl font-black">
              {cars.length}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Total Asking Value
            </p>

            <p className="mt-3 text-3xl font-black text-blue-600">
              {currency(inventoryValue)}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-zinc-500">
              Seller-Owned Listings
            </p>

            <p className="mt-3 text-4xl font-black">
              {ownedCars}
            </p>

            <p className="mt-2 text-xs text-zinc-500">
              {cars.length - ownedCars} unassigned demo listings
            </p>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">
              All Vehicle Listings
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Administrator management view
            </p>
          </div>

          <button
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="rounded-lg border bg-white px-5 py-2.5 text-sm font-semibold"
          >
            Refresh
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-7 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-[#0b1321] text-white">
                <tr>
                  <th className="px-5 py-4">Vehicle</th>
                  <th className="px-5 py-4">Price</th>
                  <th className="px-5 py-4">Location</th>
                  <th className="px-5 py-4">Owner ID</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {cars.map((car) => (
                  <tr key={car.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        {car.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={car.cover}
                            alt={`${car.make} ${car.model}`}
                            className="h-16 w-24 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-24 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400">
                            No Photo
                          </div>
                        )}

                        <div>
                          <p className="font-bold">
                            {car.year} {car.make} {car.model}
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            ID #{car.id}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 font-bold text-blue-600">
                      {currency(car.price_nzd)}
                    </td>

                    <td className="px-5 py-4">
                      {car.location}
                    </td>

                    <td className="px-5 py-4">
                      {car.owner_id === null
                        ? "Unassigned"
                        : `User #${car.owner_id}`}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/cars/${car.id}`}
                          className="rounded-lg border px-3 py-2 font-semibold"
                        >
                          View
                        </Link>

                        <Link
                          href={`/my-listings/${car.id}/edit`}
                          className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white"
                        >
                          Edit
                        </Link>

                        <button
                          onClick={() => void deleteListing(car)}
                          disabled={deleting !== null}
                          className="rounded-lg border border-red-200 px-3 py-2 font-semibold text-red-600 disabled:opacity-50"
                        >
                          {deleting === car.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {cars.length === 0 && (
            <p className="p-12 text-center text-zinc-500">
              No vehicle listings found.
            </p>
          )}
        </div>

        <p className="mt-6 text-xs text-zinc-500">
          Total Asking Value is the sum of advertised prices,
          not actual revenue. User management and moderation
          history will be added in later milestones.
        </p>
      </section>
    </main>
  );
}
