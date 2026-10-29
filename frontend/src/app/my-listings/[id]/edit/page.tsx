
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
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
};

type VehicleForm = {
  make: string;
  model: string;
  year: string;
  price_nzd: string;
  mileage_km: string;
  location: string;
};

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#111c2d] px-4 py-3 text-white outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

const locations = [
  "Auckland",
  "Wellington",
  "Christchurch",
  "Hamilton",
  "Tauranga",
  "Dunedin",
  "Queenstown",
  "Rotorua",
  "Napier",
  "Nelson",
  "Palmerston North",
  "New Plymouth",
  "Other",
];

export default function EditListingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const savingRef = useRef(false);

  const [form, setForm] = useState<VehicleForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadVehicle() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API}/api/v1/cars/${id}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "Vehicle not found."
              : "Unable to load vehicle details."
          );
        }

        const vehicle: Vehicle = await response.json();

        if (!cancelled) {
          setForm({
            make: vehicle.make,
            model: vehicle.model,
            year: String(vehicle.year),
            price_nzd: String(vehicle.price_nzd),
            mileage_km: String(vehicle.mileage_km),
            location: vehicle.location,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (/^\d+$/.test(id)) {
      void loadVehicle();
    } else {
      setError("Invalid vehicle ID.");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [id]);

  function updateField(
    field: keyof VehicleForm,
    value: string
  ) {
    setForm((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current
    );

    setError("");
    setSuccess("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || savingRef.current) return;

    const make = form.make.trim();
    const model = form.model.trim();
    const location = form.location.trim();

    // Keep number inputs as strings while editing.
    // Only convert them when the form is submitted.
    const year = Number(form.year);
    const price = Number(form.price_nzd);
    const mileage = Number(form.mileage_km);

    if (
      !make ||
      !model ||
      !location ||
      form.year.trim() === "" ||
      form.price_nzd.trim() === "" ||
      form.mileage_km.trim() === ""
    ) {
      setError("Please complete all required fields.");
      return;
    }

    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > new Date().getFullYear() + 1
    ) {
      setError("Please enter a valid vehicle year.");
      return;
    }

    if (
      !Number.isSafeInteger(price) ||
      price <= 0
    ) {
      setError("The asking price must be greater than $0.");
      return;
    }

    if (
      !Number.isSafeInteger(mileage) ||
      mileage < 0
    ) {
      setError("Please enter a valid mileage.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API}/api/v1/cars/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            make,
            model,
            year,
            price_nzd: price,
            mileage_km: mileage,
            location,
          }),
        }
      );

      if (!response.ok) {
        const details = await response
          .json()
          .catch(() => null);

        throw new Error(
          typeof details?.detail === "string"
            ? details.detail
            : "Unable to save vehicle changes."
        );
      }

      setSuccess("Vehicle updated successfully!");

      router.push(`/cars/${id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080e18] text-white">
        <p className="text-zinc-400">
          Loading vehicle details...
        </p>
      </main>
    );
  }

  if (!form) {
    return (
      <main className="min-h-screen bg-[#080e18] px-6 py-20 text-center text-white">
        <h1 className="text-2xl font-bold">
          Unable to edit vehicle
        </h1>

        <p className="mt-4 text-red-400">
          {error || "Vehicle not found."}
        </p>

        <Link
          href="/my-listings"
          className="mt-8 inline-block text-blue-400 hover:text-blue-300"
        >
          ← Back to Development Listings
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080e18] px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/my-listings"
          className="text-sm font-medium text-blue-400 transition hover:text-blue-300"
        >
          ← Back to Development Listings
        </Link>

        <p className="mt-12 text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
          REVV / LISTING MANAGEMENT
        </p>

        <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
          Edit Your Vehicle
        </h1>

        <p className="mt-4 text-zinc-400">
          Update listing #{id}. Your changes will
          be saved directly to PostgreSQL.
        </p>

        <form
          onSubmit={save}
          className="mt-10 space-y-8"
        >
          {/* VEHICLE DETAILS */}
          <section className="rounded-2xl border border-white/10 bg-[#0d1726] p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
              01 / VEHICLE DETAILS
            </p>

            <h2 className="mt-3 text-2xl font-bold">
              Vehicle Information
            </h2>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div>
                <label
                  htmlFor="edit-make"
                  className="block text-sm font-medium text-zinc-300"
                >
                  Make *
                </label>

                <input
                  id="edit-make"
                  type="text"
                  required
                  maxLength={100}
                  value={form.make}
                  onChange={(event) =>
                    updateField("make", event.target.value)
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-model"
                  className="block text-sm font-medium text-zinc-300"
                >
                  Model *
                </label>

                <input
                  id="edit-model"
                  type="text"
                  required
                  maxLength={100}
                  value={form.model}
                  onChange={(event) =>
                    updateField("model", event.target.value)
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-year"
                  className="block text-sm font-medium text-zinc-300"
                >
                  Year *
                </label>

                <input
                  id="edit-year"
                  type="number"
                  required
                  min={1900}
                  max={new Date().getFullYear() + 1}
                  step={1}
                  value={form.year}
                  onChange={(event) =>
                    updateField("year", event.target.value)
                  }
                  placeholder="e.g. 2024"
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-mileage"
                  className="block text-sm font-medium text-zinc-300"
                >
                  Mileage (km) *
                </label>

                <input
                  id="edit-mileage"
                  type="number"
                  required
                  min={0}
                  step={1}
                  value={form.mileage_km}
                  onChange={(event) =>
                    updateField(
                      "mileage_km",
                      event.target.value
                    )
                  }
                  placeholder="e.g. 50000"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          {/* PRICING AND LOCATION */}
          <section className="rounded-2xl border border-white/10 bg-[#0d1726] p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
              02 / LISTING DETAILS
            </p>

            <h2 className="mt-3 text-2xl font-bold">
              Price and Location
            </h2>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div>
                <label
                  htmlFor="edit-price"
                  className="block text-sm font-medium text-zinc-300"
                >
                  Asking Price (NZD) *
                </label>

                <input
                  id="edit-price"
                  type="number"
                  required
                  min={1}
                  step={1}
                  value={form.price_nzd}
                  onChange={(event) =>
                    updateField(
                      "price_nzd",
                      event.target.value
                    )
                  }
                  placeholder="e.g. 20000"
                  className={inputClass}
                />

                <p className="mt-2 text-xs text-zinc-500">
                  Enter the amount without commas or
                  a dollar sign.
                </p>
              </div>

              <div>
                <label
                  htmlFor="edit-location"
                  className="block text-sm font-medium text-zinc-300"
                >
                  Location *
                </label>

                <select
                  id="edit-location"
                  required
                  value={form.location}
                  onChange={(event) =>
                    updateField(
                      "location",
                      event.target.value
                    )
                  }
                  className={inputClass}
                >
                  {!locations.includes(form.location) &&
                    form.location !== "" && (
                      <option value={form.location}>
                        {form.location}
                      </option>
                    )}

                  <option value="">
                    Select location
                  </option>

                  {locations.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* PHOTO MANAGEMENT */}
          <section className="rounded-2xl border border-white/10 bg-[#0d1726] p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
              03 / VEHICLE PHOTOS
            </p>

            <h2 className="mt-3 text-2xl font-bold">
              Manage Photos
            </h2>

            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Your existing vehicle photos will remain
              attached when you update the listing.
              Adding, removing and changing cover photos
              will be available through seller account
              management in a future update.
            </p>

            <Link
              href={`/cars/${id}`}
              className="mt-5 inline-block text-sm font-semibold text-blue-400 hover:text-blue-300"
            >
              View current vehicle photos →
            </Link>
          </section>

          {/* ERROR / SUCCESS */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              role="status"
              className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300"
            >
              {success}
            </div>
          )}

          {/* ACTIONS */}
          <div className="flex flex-wrap gap-4">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-blue-600 px-8 py-4 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving Changes..."
                : "Save Changes"}
            </button>

            <Link
              href="/my-listings"
              className="rounded-xl border border-white/20 px-8 py-4 font-semibold text-white transition hover:bg-white/10"
            >
              Cancel
            </Link>
          </div>

          <p className="text-xs text-zinc-500">
            Development mode: Listing edits are not
            restricted by seller accounts yet.
          </p>
        </form>
      </div>
    </main>
  );
}
