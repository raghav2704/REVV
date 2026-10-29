
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useEffect,
  useState,
  type FormEvent,
} from "react";

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

type FormFields = {
  make: string;
  model: string;
  year: string;
  price_nzd: string;
  mileage_km: string;
  location: string;
};

const inputStyle =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#111c2d] px-4 py-3 text-white outline-none focus:border-blue-500";

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();

  const [form, setForm] = useState<FormFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [userResponse, carResponse] = await Promise.all([
          fetch(`${API}/api/v1/auth/me`, {
            credentials: "include",
            cache: "no-store",
          }),
          fetch(`${API}/api/v1/cars/${id}`, {
            cache: "no-store",
          }),
        ]);

        if (!userResponse.ok) {
          throw new Error("Please log in first.");
        }

        if (!carResponse.ok) {
          throw new Error("Vehicle not found.");
        }

        const user: {
          id: number;
          role: string;
        } = await userResponse.json();

        const car: Vehicle = await carResponse.json();

        if (user.role !== "admin" && car.owner_id !== user.id) {
          throw new Error(
            "You don't have permission to edit this vehicle."
          );
        }

        if (!active) return;

        setAllowed(true);
        setForm({
          make: car.make,
          model: car.model,
          year: String(car.year),
          price_nzd: String(car.price_nzd),
          mileage_km: String(car.mileage_km),
          location: car.location,
        });
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load listing."
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
  }, [id]);

  function update(key: keyof FormFields, value: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || saving) return;

    const year = Number(form.year);
    const price = Number(form.price_nzd);
    const mileage = Number(form.mileage_km);

    if (
      !form.make.trim() ||
      !form.model.trim() ||
      !form.location.trim() ||
      !form.year ||
      !form.price_nzd ||
      !form.mileage_km
    ) {
      setError("Please complete all fields.");
      return;
    }

    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 2100 ||
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      !Number.isSafeInteger(mileage) ||
      mileage < 0
    ) {
      setError("Please enter valid vehicle information.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/v1/cars/${id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            make: form.make.trim(),
            model: form.model.trim(),
            year,
            price_nzd: price,
            mileage_km: mileage,
            location: form.location.trim(),
          }),
        }
      );

      if (response.status === 401) {
        throw new Error("Your session expired. Please log in.");
      }

      if (response.status === 403) {
        throw new Error(
          "You don't have permission to edit this listing."
        );
      }

      if (!response.ok) {
        throw new Error("Unable to save changes.");
      }

      window.location.assign(`/cars/${id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Save failed."
      );
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080e18] p-16 text-center text-white">
        Loading listing...
      </main>
    );
  }

  if (!allowed || !form) {
    return (
      <main className="min-h-screen bg-[#080e18] px-6 py-20 text-center text-white">
        <h1 className="text-3xl font-bold">
          Unable to Edit Listing
        </h1>
        <p className="mt-4 text-red-300">{error}</p>
        <Link
          href="/my-listings"
          className="mt-6 inline-block text-blue-400"
        >
          Back to My Listings
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080e18] px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/my-listings"
          className="text-sm text-blue-400"
        >
          ← Back to My Listings
        </Link>

        <p className="mt-12 text-xs font-bold uppercase tracking-widest text-blue-400">
          REVV / MANAGE LISTING
        </p>

        <h1 className="mt-4 text-4xl font-black">
          Edit Vehicle
        </h1>

        <p className="mt-3 text-zinc-400">
          Update listing #{id}.
        </p>

        <form onSubmit={save} className="mt-10 space-y-8">
          <section className="rounded-2xl border border-white/10 bg-[#0d1726] p-6 md:p-8">
            <h2 className="text-2xl font-bold">
              Vehicle Details
            </h2>

            <div className="mt-7 grid gap-6 md:grid-cols-2">
              {(
                [
                  ["make", "Make"],
                  ["model", "Model"],
                  ["year", "Year"],
                  ["mileage_km", "Mileage (km)"],
                  ["price_nzd", "Asking Price (NZD)"],
                  ["location", "Location"],
                ] as const
              ).map(([field, label]) => {
                const numeric = [
                  "year",
                  "mileage_km",
                  "price_nzd",
                ].includes(field);

                return (
                  <label
                    key={field}
                    className="block text-sm text-zinc-300"
                  >
                    {label} *
                    <input
                      type={numeric ? "number" : "text"}
                      required
                      min={
                        field === "year"
                          ? 1900
                          : field === "price_nzd"
                            ? 1
                            : numeric
                              ? 0
                              : undefined
                      }
                      max={field === "year" ? 2100 : undefined}
                      maxLength={numeric ? undefined : 100}
                      step={numeric ? 1 : undefined}
                      value={form[field]}
                      onChange={(e) =>
                        update(field, e.target.value)
                      }
                      className={inputStyle}
                    />
                  </label>
                );
              })}
            </div>
          </section>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-300"
            >
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-8 py-4 font-bold hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>

            <Link
              href="/my-listings"
              className="rounded-xl border border-white/20 px-8 py-4 font-semibold"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
