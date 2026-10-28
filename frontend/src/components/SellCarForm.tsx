
"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

type VehicleForm = {
  make: string;
  model: string;
  year: string;
  price_nzd: string;
  mileage_km: string;
  location: string;
};

const initialForm: VehicleForm = {
  make: "",
  model: "",
  year: "",
  price_nzd: "",
  mileage_km: "",
  location: "",
};

const locations = [
  "Auckland",
  "Wellington",
  "Christchurch",
  "Hamilton",
  "Tauranga",
  "Dunedin",
  "Queenstown",
  "Rotorua",
  "Palmerston North",
  "Napier",
  "Nelson",
  "New Plymouth",
  "Other",
];

const inputStyle =
  "w-full rounded-xl border border-white/10 bg-[#111c2d] px-4 py-3.5 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

const labelStyle =
  "mb-2 block text-sm font-medium text-slate-300";

export default function SellCarForm() {
  const router = useRouter();

  const submittingRef = useRef(false);
  const [form, setForm] = useState<VehicleForm>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateField(
    field: keyof VehicleForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submittingRef.current) return;

    setError("");

    const year = Number(form.year);
    const price = Number(form.price_nzd);
    const mileage = Number(form.mileage_km);
    const currentYear = new Date().getFullYear();

    if (
      !form.make.trim() ||
      !form.model.trim() ||
      !form.location ||
      !form.year ||
      !form.price_nzd ||
      !form.mileage_km
    ) {
      setError("Please complete all vehicle details.");
      return;
    }

    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > currentYear + 1
    ) {
      setError("Please enter a valid vehicle year.");
      return;
    }

    if (
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      !Number.isSafeInteger(mileage) ||
      mileage < 0
    ) {
      setError("Please enter valid price and mileage values.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/api/v1/cars",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            make: form.make.trim(),
            model: form.model.trim(),
            year,
            price_nzd: price,
            mileage_km: mileage,
            location: form.location,
          }),
        }
      );

      if (!response.ok) {
        const details = await response
          .json()
          .catch(() => null);

        const message =
          typeof details?.detail === "string"
            ? details.detail
            : "Unable to create the listing.";

        throw new Error(message);
      }

      const created: { id: number } =
        await response.json();

      router.push(`/cars/${created.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* VEHICLE DETAILS */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1726] p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
          01 / VEHICLE DETAILS
        </p>

        <h2 className="mt-3 text-2xl font-bold text-white">
          Tell us about your car
        </h2>

        <p className="mb-8 mt-2 text-sm text-slate-400">
          Enter the basic information about your vehicle.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="make" className={labelStyle}>
              Make *
            </label>
            <input
              id="make"
              required
              maxLength={100}
              value={form.make}
              onChange={(e) =>
                updateField("make", e.target.value)
              }
              placeholder="e.g. BMW"
              className={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="model" className={labelStyle}>
              Model *
            </label>
            <input
              id="model"
              required
              maxLength={100}
              value={form.model}
              onChange={(e) =>
                updateField("model", e.target.value)
              }
              placeholder="e.g. 320i"
              className={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="year" className={labelStyle}>
              Year *
            </label>
            <input
              id="year"
              type="number"
              required
              min={1900}
              max={new Date().getFullYear() + 1}
              step={1}
              value={form.year}
              onChange={(e) =>
                updateField("year", e.target.value)
              }
              placeholder="e.g. 2024"
              className={inputStyle}
            />
          </div>

          <div>
            <label htmlFor="mileage" className={labelStyle}>
              Mileage (km) *
            </label>
            <input
              id="mileage"
              type="number"
              required
              min={0}
              step={1}
              value={form.mileage_km}
              onChange={(e) =>
                updateField("mileage_km", e.target.value)
              }
              placeholder="e.g. 18000"
              className={inputStyle}
            />
          </div>
        </div>
      </section>

      {/* LISTING DETAILS */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1726] p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
          02 / LISTING DETAILS
        </p>

        <h2 className="mt-3 text-2xl font-bold text-white">
          Price and location
        </h2>

        <p className="mb-8 mt-2 text-sm text-slate-400">
          Set your asking price and vehicle location.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="price" className={labelStyle}>
              Asking price (NZD) *
            </label>
            <input
              id="price"
              type="number"
              min={1}
              step={1}
              required
              value={form.price_nzd}
              onChange={(e) =>
                updateField("price_nzd", e.target.value)
              }
              placeholder="e.g. 59990"
              className={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="location"
              className={labelStyle}
            >
              Location *
            </label>
            <select
              id="location"
              required
              value={form.location}
              onChange={(e) =>
                updateField("location", e.target.value)
              }
              className={inputStyle}
            >
              <option value="">Select location</option>

              {locations.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* DEVELOPMENT NOTICE */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-5">
        <p className="text-sm leading-6 text-blue-100">
          <strong>Development mode:</strong> Listings
          created here are for testing REVV.
          User accounts, vehicle photos and seller
          verification will be added later.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-blue-600 px-6 py-5 text-base font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? "Creating Listing..."
          : "Create Demo Listing →"}
      </button>

      <p className="text-center text-xs text-slate-500">
        Your vehicle will be saved to the REVV
        development database.
      </p>
    </form>
  );
}
