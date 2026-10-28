
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://127.0.0.1:8000";
const MAX_PHOTOS = 10;
const MAX_SIZE = 5 * 1024 * 1024;

type VehicleForm = {
  make: string;
  model: string;
  year: string;
  mileage_km: string;
  price_nzd: string;
  location: string;
};

type SelectedPhoto = {
  id: string;
  file: File;
  preview: string;
};

const initialForm: VehicleForm = {
  make: "",
  model: "",
  year: "",
  mileage_km: "",
  price_nzd: "",
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
  "Napier",
  "Nelson",
  "Palmerston North",
  "New Plymouth",
  "Other",
];

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#111c2d] px-4 py-3.5 text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

const labelClass =
  "mb-2 block text-sm font-medium text-slate-300";

export default function SellCarForm() {
  const router = useRouter();

  const submittingRef = useRef(false);
  const photosRef = useRef<SelectedPhoto[]>([]);

  const [form, setForm] = useState(initialForm);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [uploadCompleted, setUploadCompleted] = useState(false);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => {
        URL.revokeObjectURL(photo.preview);
      });
    };
  }, []);

  function updateField(
    field: keyof VehicleForm,
    value: string
  ) {
    if (createdId !== null) return;

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handlePhotos(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) return;

    if (photos.length + files.length > MAX_PHOTOS) {
      setError("You can upload a maximum of 10 photos.");
      return;
    }

    for (const file of files) {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(
          file.type
        )
      ) {
        setError("Only JPG, PNG and WEBP images are supported.");
        return;
      }

      if (file.size > MAX_SIZE) {
        setError("Each photo must be 5 MB or smaller.");
        return;
      }
    }

    const newPhotos = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));

    setPhotos((current) => [...current, ...newPhotos]);
    setCoverId((current) => current ?? newPhotos[0].id);
    setError("");
  }

  function removePhoto(id: string) {
    const removed = photos.find((photo) => photo.id === id);

    if (removed) {
      URL.revokeObjectURL(removed.preview);
    }

    const updated = photos.filter((photo) => photo.id !== id);
    setPhotos(updated);

    if (coverId === id) {
      setCoverId(updated[0]?.id ?? null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current || uploadCompleted) return;

    setError("");

    const year = Number(form.year);
    const price = Number(form.price_nzd);
    const mileage = Number(form.mileage_km);

    if (
      !form.make.trim() ||
      !form.model.trim() ||
      !form.location ||
      !form.year ||
      !form.price_nzd ||
      !form.mileage_km
    ) {
      setError("Please complete all required fields.");
      return;
    }

    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > new Date().getFullYear() + 1
    ) {
      setError("Enter a valid vehicle year.");
      return;
    }

    if (
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      !Number.isSafeInteger(mileage) ||
      mileage < 0
    ) {
      setError("Enter a valid price and mileage.");
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      let vehicleId = createdId;

      // 1. Create the vehicle only once.
      if (vehicleId === null) {
        setStatus("Saving vehicle details...");

        const response = await fetch(`${API_URL}/api/v1/cars`, {
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
        });

        if (!response.ok) {
          throw new Error("Could not save the vehicle.");
        }

        const created: { id: number } = await response.json();

        vehicleId = created.id;
        setCreatedId(vehicleId);
      }

      // 2. Upload the selected photos.
      if (photos.length > 0) {
        setStatus("Uploading vehicle photos...");

        // Backend automatically makes the first image
        // the cover, so send the selected cover first.
        const orderedPhotos = [...photos].sort((a, b) => {
          if (a.id === coverId) return -1;
          if (b.id === coverId) return 1;
          return 0;
        });

        const data = new FormData();

        orderedPhotos.forEach((photo) => {
          data.append("files", photo.file);
        });

        const response = await fetch(
          `${API_URL}/api/v1/cars/${vehicleId}/images`,
          {
            method: "POST",
            body: data,
          }
        );

        if (!response.ok) {
          const details = await response.json().catch(() => null);

          throw new Error(
            typeof details?.detail === "string"
              ? details.detail
              : "Photo upload failed. The vehicle was saved."
          );
        }
      }

      // 3. Open the completed listing.
      setStatus("Listing created successfully!");
      setUploadCompleted(true);

      router.push(`/cars/${vehicleId}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
      setStatus("");
      setSubmitting(false);
      submittingRef.current = false;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* VEHICLE DETAILS */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1726] p-6 md:p-8">
        <p className="text-xs font-bold tracking-widest text-blue-400">
          01 / VEHICLE DETAILS
        </p>

        <h2 className="mt-3 text-2xl font-bold text-white">
          Tell us about your car
        </h2>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {([
            ["make", "Make", "BMW"],
            ["model", "Model", "320i"],
          ] as const).map(([key, label, placeholder]) => (
            <div key={key}>
              <label htmlFor={key} className={labelClass}>
                {label} *
              </label>
              <input
                id={key}
                required
                maxLength={100}
                disabled={submitting || createdId !== null}
                value={form[key]}
                onChange={(e) => updateField(key, e.target.value)}
                placeholder={placeholder}
                className={inputClass}
              />
            </div>
          ))}

          <div>
            <label htmlFor="year" className={labelClass}>
              Year *
            </label>
            <input
              id="year"
              type="number"
              min="1900"
              max={new Date().getFullYear() + 1}
              step="1"
              required
              disabled={submitting || createdId !== null}
              value={form.year}
              onChange={(e) => updateField("year", e.target.value)}
              placeholder="2024"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="mileage" className={labelClass}>
              Mileage (km) *
            </label>
            <input
              id="mileage"
              type="number"
              min="0"
              step="1"
              required
              disabled={submitting || createdId !== null}
              value={form.mileage_km}
              onChange={(e) =>
                updateField("mileage_km", e.target.value)
              }
              placeholder="18000"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* LISTING DETAILS */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1726] p-6 md:p-8">
        <p className="text-xs font-bold tracking-widest text-blue-400">
          02 / LISTING DETAILS
        </p>

        <h2 className="mt-3 text-2xl font-bold text-white">
          Price and location
        </h2>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div>
            <label htmlFor="price" className={labelClass}>
              Asking price (NZD) *
            </label>
            <input
              id="price"
              type="number"
              min="1"
              step="1"
              required
              disabled={submitting || createdId !== null}
              value={form.price_nzd}
              onChange={(e) =>
                updateField("price_nzd", e.target.value)
              }
              placeholder="59990"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="location" className={labelClass}>
              Location *
            </label>
            <select
              id="location"
              required
              disabled={submitting || createdId !== null}
              value={form.location}
              onChange={(e) =>
                updateField("location", e.target.value)
              }
              className={inputClass}
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

      {/* VEHICLE PHOTOS */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1726] p-6 md:p-8">
        <p className="text-xs font-bold tracking-widest text-blue-400">
          03 / VEHICLE PHOTOS
        </p>

        <h2 className="mt-3 text-2xl font-bold text-white">
          Show off your car
        </h2>

        <p className="mt-2 text-sm text-slate-400">
          Select up to 10 photos (JPG, PNG or WEBP).
          Maximum 5 MB each.
        </p>

        <label
          htmlFor="vehicle-photos"
          className="mt-7 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-500/30 bg-[#111c2d] px-6 py-12 text-center transition hover:border-blue-400"
        >
          <span className="text-4xl">📸</span>
          <span className="mt-4 font-semibold text-white">
            Select vehicle photos
          </span>
          <span className="mt-2 text-sm text-slate-400">
            Choose photos from your Mac
          </span>
          <input
            id="vehicle-photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={submitting}
            onChange={handlePhotos}
            className="sr-only"
          />
        </label>

        {photos.length > 0 && (
          <div className="mt-8">
            <div className="mb-4 flex justify-between">
              <p className="font-semibold text-white">
                Selected Photos
              </p>
              <span className="text-sm text-slate-400">
                {photos.length} / 10
              </span>
            </div>

            <p className="mb-5 text-sm text-slate-400">
              Click "Set as cover" to choose the main
              marketplace photo.
            </p>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-[#111c2d]"
                >
                  {/* Preview of locally selected file */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.preview}
                    alt={photo.file.name}
                    className="aspect-[4/3] w-full object-cover"
                  />

                  <div className="space-y-3 p-3">
                    <p className="truncate text-xs text-slate-300">
                      {photo.file.name}
                    </p>

                    {coverId === photo.id ? (
                      <span className="block text-xs font-semibold text-blue-400">
                        ★ Cover Photo
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setCoverId(photo.id)}
                        className="text-xs font-semibold text-white hover:text-blue-400"
                      >
                        Set as cover
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => removePhoto(photo.id)}
                      className="block text-xs text-red-400 hover:text-red-300"
                    >
                      Remove photo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* DEVELOPMENT NOTICE */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-5 text-sm leading-6 text-blue-100">
        <strong>REVV Development Mode:</strong> This creates
        a demonstration listing. User accounts and
        seller verification will be added later.
      </div>

      {createdId !== null && !uploadCompleted && error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Vehicle #{createdId} has already been saved.
          Retrying will upload the photos to that listing,
          rather than creating another vehicle.
          If the previous upload may have succeeded,
          check the listing before retrying to avoid
          duplicate photos.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {status && (
        <p role="status" className="text-center text-sm text-blue-300">
          {status}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || uploadCompleted}
        className="w-full rounded-xl bg-blue-600 px-6 py-5 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? "Creating Your Listing..."
          : createdId !== null
          ? "Retry Photo Upload"
          : "Create Demo Listing →"}
      </button>
    </form>
  );
}
