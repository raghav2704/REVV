
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

const API = "http://127.0.0.1:8000";
const MAX_FILES = 10;
const MAX_BYTES = 5 * 1024 * 1024;

type FormFields = {
  make: string;
  model: string;
  year: string;
  price_nzd: string;
  mileage_km: string;
  location: string;
};

type Photo = {
  id: string;
  file: File;
  preview: string;
};

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#111c2d] px-4 py-3 text-white outline-none focus:border-blue-500";

export default function SellCarForm() {
  const router = useRouter();

  const [form, setForm] = useState<FormFields>({
    make: "",
    model: "",
    year: "",
    price_nzd: "",
    mileage_km: "",
    location: "Auckland",
  });

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [accountLoading, setAccountLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  const createdId = useRef<number | null>(null);
  const photosRef = useRef<Photo[]>([]);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) =>
        URL.revokeObjectURL(photo.preview)
      );
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function checkAccount() {
      try {
        const response = await fetch(
          `${API}/api/v1/auth/me`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        if (active) setSignedIn(response.ok);
      } catch {
        if (active) setSignedIn(false);
      } finally {
        if (active) setAccountLoading(false);
      }
    }

    void checkAccount();

    return () => {
      active = false;
    };
  }, []);

  function update(field: keyof FormFields, value: string) {
    if (createdId.current !== null) return;

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function addPhotos(files: FileList | null) {
    if (!files) return;

    const incoming = Array.from(files);
    const remaining = MAX_FILES - photos.length;

    if (incoming.length > remaining) {
      setError(`You can upload a maximum of ${MAX_FILES} photos.`);
      return;
    }

    for (const file of incoming) {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(
          file.type
        )
      ) {
        setError("Only JPG, PNG and WEBP images are supported.");
        return;
      }

      if (file.size > MAX_BYTES) {
        setError("Each photo must be 5 MB or less.");
        return;
      }
    }

    const additions = incoming.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
    }));

    setPhotos((current) => [...current, ...additions]);

    if (!coverId && additions.length > 0) {
      setCoverId(additions[0].id);
    }

    setError("");

    if (photoInput.current) {
      photoInput.current.value = "";
    }
  }

  function removePhoto(id: string) {
    const photo = photos.find((item) => item.id === id);

    if (photo) URL.revokeObjectURL(photo.preview);

    const remaining = photos.filter((item) => item.id !== id);

    setPhotos(remaining);

    if (coverId === id) {
      setCoverId(remaining[0]?.id ?? null);
    }
  }

  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    if (!signedIn) {
      setError("Please log in before creating a listing.");
      return;
    }

    const year = Number(form.year);
    const price = Number(form.price_nzd);
    const mileage = Number(form.mileage_km);

    if (createdId.current === null) {
      if (
        !form.make.trim() ||
        !form.model.trim() ||
        !form.location.trim() ||
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
        year > 2100 ||
        !Number.isSafeInteger(price) ||
        price <= 0 ||
        !Number.isSafeInteger(mileage) ||
        mileage < 0
      ) {
        setError("Please enter valid year, price and mileage.");
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      let carId = createdId.current;

      if (carId === null) {
        const response = await fetch(`${API}/api/v1/cars`, {
          method: "POST",
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
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error("Your session expired. Please log in again.");
          }

          throw new Error("Unable to create vehicle listing.");
        }

        const car: { id: number } = await response.json();

        carId = car.id;
        createdId.current = carId;
      }

      if (photos.length > 0) {
        const ordered = [...photos].sort((a, b) => {
          if (a.id === coverId) return -1;
          if (b.id === coverId) return 1;
          return 0;
        });

        const data = new FormData();

        ordered.forEach((photo) => {
          data.append("files", photo.file);
        });

        const response = await fetch(
          `${API}/api/v1/cars/${carId}/images`,
          {
            method: "POST",
            credentials: "include",
            body: data,
          }
        );

        if (!response.ok) {
          throw new Error(
            "Listing created, but photos were not uploaded. " +
              "Check your connection and retry. " +
              "Do not refresh this page before retrying."
          );
        }
      }

      window.location.assign(`/cars/${carId}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to publish listing."
      );
      setSaving(false);
    }
  }

  if (accountLoading) {
    return (
      <div className="rounded-2xl bg-[#0d1726] p-8 text-white">
        Checking your REVV account...
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0d1726] p-8 text-white">
        <h2 className="text-2xl font-bold">
          Login required
        </h2>
        <p className="mt-3 text-zinc-400">
          Sign in to your REVV account to sell a car.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={publish} className="space-y-8 text-white">
      <section className="rounded-2xl border border-white/10 bg-[#0d1726] p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
          01 / VEHICLE INFORMATION
        </p>
        <h2 className="mt-3 text-2xl font-bold">
          Tell us about your car
        </h2>

        <div className="mt-7 grid gap-6 md:grid-cols-2">
          {(
            [
              ["make", "Make", "BMW"],
              ["model", "Model", "320i"],
              ["year", "Year", "2024"],
              ["mileage_km", "Mileage (km)", "20000"],
              ["price_nzd", "Asking Price (NZD)", "59990"],
              ["location", "Location", "Auckland"],
            ] as const
          ).map(([field, label, placeholder]) => {
            const numeric = [
              "year",
              "mileage_km",
              "price_nzd",
            ].includes(field);

            return (
              <label key={field} className="block text-sm text-zinc-300">
                {label} *
                <input
                  type={numeric ? "number" : "text"}
                  required
                  disabled={createdId.current !== null}
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
                  step={numeric ? 1 : undefined}
                  maxLength={numeric ? undefined : 100}
                  placeholder={placeholder}
                  value={form[field]}
                  onChange={(e) => update(field, e.target.value)}
                  className={inputClass}
                />
              </label>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#0d1726] p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
          02 / PHOTOS
        </p>

        <h2 className="mt-3 text-2xl font-bold">
          Show off your vehicle
        </h2>

        <p className="mt-3 text-sm text-zinc-400">
          Add up to 10 photos. Choose the one to use as the cover.
        </p>

        <input
          ref={photoInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => addPhotos(e.target.files)}
          className="mt-6 block w-full rounded-xl border border-dashed border-white/20 p-5 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white"
        />

        {photos.length > 0 && (
          <div className="mt-7 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-[#111c2d]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.preview}
                  alt="Vehicle upload preview"
                  className="h-40 w-full object-cover"
                />

                <div className="space-y-2 p-3">
                  <button
                    type="button"
                    onClick={() => setCoverId(photo.id)}
                    className={`w-full rounded-lg px-3 py-2 text-xs font-bold ${
                      coverId === photo.id
                        ? "bg-blue-600"
                        : "bg-white/10"
                    }`}
                  >
                    {coverId === photo.id
                      ? "Cover Photo ✓"
                      : "Set as Cover"}
                  </button>

                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="w-full rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-blue-600 px-8 py-4 font-bold hover:bg-blue-500 disabled:opacity-50"
        >
          {saving
            ? "Publishing..."
            : createdId.current !== null
              ? "Retry Photo Upload"
              : "Publish Listing"}
        </button>

        <Link
          href="/my-listings"
          className="rounded-xl border border-white/20 px-8 py-4 font-semibold"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
