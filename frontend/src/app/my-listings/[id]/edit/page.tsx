
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
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

type Account = {
  id: number;
  role: string;
  full_name?: string;
  email?: string;
};

type Photo = {
  id: number;
  url: string;
  is_cover: boolean;
  position: number;
};

type FormValues = {
  make: string;
  model: string;
  year: string;
  price_nzd: string;
  mileage_km: string;
  location: string;
};

type ApiEnvelope<T> = T | { data: T };

function unwrap<T>(value: ApiEnvelope<T>): T {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "data" in value
  ) {
    return value.data;
  }

  return value as T;
}

async function checkResponse(response: Response) {
  if (response.status === 401) {
    throw new Error("Please log in again.");
  }

  if (response.status === 403) {
    throw new Error(
      "Access denied. You do not have permission to edit this vehicle."
    );
  }

  if (response.status === 404) {
    throw new Error("This vehicle could not be found.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);

    throw new Error(
      typeof body?.detail === "string"
        ? body.detail
        : `Request failed (${response.status}).`
    );
  }
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);
}

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#111c2d] px-4 py-3 text-white outline-none focus:border-blue-500";

export default function EditVehiclePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [account, setAccount] = useState<Account | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<FormValues | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isAdmin = account?.role === "admin";

  const canEdit =
    account !== null &&
    vehicle !== null &&
    (isAdmin || vehicle.owner_id === account.id);

  const backLink = isAdmin ? "/admin" : "/my-listings";

  const loadPhotos = useCallback(async () => {
    const response = await fetch(
      `${API}/api/v1/cars/${id}/images`,
      { cache: "no-store" }
    );

    await checkResponse(response);

    const result: ApiEnvelope<{ images: Photo[] }> =
      await response.json();

    const gallery = unwrap(result);

    const images = Array.isArray(gallery.images)
      ? gallery.images
      : [];

    setPhotos(
      [...images].sort(
        (a, b) => a.position - b.position || a.id - b.id
      )
    );
  }, [id]);

  useEffect(() => {
    let active = true;

    async function loadVehicle() {
      setLoading(true);
      setError("");

      try {
        const [accountResponse, vehicleResponse, photoResponse] =
          await Promise.all([
            fetch(`${API}/api/v1/auth/me`, {
              credentials: "include",
              cache: "no-store",
            }),
            fetch(`${API}/api/v1/cars/${id}`, {
              cache: "no-store",
            }),
            fetch(`${API}/api/v1/cars/${id}/images`, {
              cache: "no-store",
            }),
          ]);

        await checkResponse(accountResponse);
        await checkResponse(vehicleResponse);
        await checkResponse(photoResponse);

        const accountResult: ApiEnvelope<Account> =
          await accountResponse.json();

        const vehicleResult: ApiEnvelope<Vehicle> =
          await vehicleResponse.json();

        const galleryResult: ApiEnvelope<{ images: Photo[] }> =
          await photoResponse.json();

        const currentAccount = unwrap(accountResult);
        const currentVehicle = unwrap(vehicleResult);
        const gallery = unwrap(galleryResult);

        if (
          !currentAccount ||
          !Number.isInteger(currentAccount.id) ||
          !currentVehicle ||
          !Number.isInteger(currentVehicle.id)
        ) {
          throw new Error("Invalid account or vehicle response.");
        }

        if (
          currentAccount.role !== "admin" &&
          currentVehicle.owner_id !== currentAccount.id
        ) {
          throw new Error(
            "You do not have permission to edit this listing."
          );
        }

        if (!active) return;

        setAccount(currentAccount);
        setVehicle(currentVehicle);

        setForm({
          make: currentVehicle.make,
          model: currentVehicle.model,
          year: String(currentVehicle.year),
          price_nzd: String(currentVehicle.price_nzd),
          mileage_km: String(currentVehicle.mileage_km),
          location: currentVehicle.location,
        });

        setPhotos(
          [...(Array.isArray(gallery.images) ? gallery.images : [])]
            .sort(
              (a, b) =>
                a.position - b.position || a.id - b.id
            )
        );
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load this listing."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadVehicle();

    return () => {
      active = false;
    };
  }, [id]);

  function updateField(
    field: keyof FormValues,
    value: string
  ) {
    setForm((current) =>
      current ? { ...current, [field]: value } : null
    );
    setSuccess("");
  }

  async function saveVehicle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form || !canEdit || busy) return;

    const year = Number(form.year);
    const price = Number(form.price_nzd);
    const mileage = Number(form.mileage_km);

    if (
      !form.make.trim() ||
      !form.model.trim() ||
      !form.location.trim() ||
      !form.year.trim() ||
      !form.price_nzd.trim() ||
      !form.mileage_km.trim() ||
      !Number.isInteger(year) ||
      year < 1900 ||
      year > 2100 ||
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      !Number.isSafeInteger(mileage) ||
      mileage < 0
    ) {
      setError("Please enter valid vehicle details.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

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

      await checkResponse(response);

      setVehicle((current) =>
        current
          ? {
              ...current,
              make: form.make.trim(),
              model: form.model.trim(),
              year,
              price_nzd: price,
              mileage_km: mileage,
              location: form.location.trim(),
            }
          : null
      );

      setSuccess("Vehicle details saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Save failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhotos() {
    if (!canEdit || busy || selectedFiles.length === 0) return;

    if (photos.length + selectedFiles.length > 10) {
      setError("A vehicle can have a maximum of 10 photos.");
      return;
    }

    if (
      selectedFiles.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(
            file.type
          ) ||
          file.size > 5 * 1024 * 1024
      )
    ) {
      setError(
        "Use JPG, PNG or WEBP files, maximum 5 MB each."
      );
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const body = new FormData();

      selectedFiles.forEach((file) => {
        body.append("files", file);
      });

      const response = await fetch(
        `${API}/api/v1/cars/${id}/images`,
        {
          method: "POST",
          credentials: "include",
          body,
        }
      );

      await checkResponse(response);
      await loadPhotos();

      setSelectedFiles([]);
      setFileInputKey((current) => current + 1);

      setSuccess("Photos uploaded successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto(photo: Photo) {
    if (
      !canEdit ||
      busy ||
      !window.confirm("Permanently delete this photo?")
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API}/api/v1/cars/${id}/images/${photo.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      await checkResponse(response);
      await loadPhotos();

      setSuccess("Photo deleted.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Delete failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function setCover(photo: Photo) {
    if (!canEdit || busy || photo.is_cover) return;

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API}/api/v1/cars/${id}/images/${photo.id}/cover`,
        {
          method: "PATCH",
          credentials: "include",
        }
      );

      await checkResponse(response);
      await loadPhotos();

      setSuccess("Cover photo updated.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to change cover photo."
      );
    } finally {
      setBusy(false);
    }
  }

  async function movePhoto(
    index: number,
    direction: -1 | 1
  ) {
    const nextIndex = index + direction;

    if (
      !canEdit ||
      busy ||
      nextIndex < 0 ||
      nextIndex >= photos.length
    ) {
      return;
    }

    const ordered = [...photos];

    [ordered[index], ordered[nextIndex]] = [
      ordered[nextIndex],
      ordered[index],
    ];

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API}/api/v1/cars/${id}/images/order`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_ids: ordered.map((photo) => photo.id),
          }),
        }
      );

      await checkResponse(response);
      await loadPhotos();

      setSuccess("Photo order saved.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to reorder photos."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080e18] p-12 text-white">
        Loading vehicle details...
      </main>
    );
  }

  if (!form || !canEdit) {
    return (
      <main className="min-h-screen bg-[#080e18] px-6 py-20 text-center text-white">
        <h1 className="text-3xl font-bold">
          Unable to Edit Vehicle
        </h1>

        <p className="mt-4 text-red-300">
          {error || "You do not have access to this listing."}
        </p>

        <Link
          href={backLink}
          className="mt-8 inline-block rounded-xl bg-blue-600 px-6 py-3 font-semibold"
        >
          Back to Listings
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080e18] px-5 py-14 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href={backLink}
          className="text-sm font-semibold text-blue-400"
        >
          ← Back to {isAdmin ? "Admin Dashboard" : "My Listings"}
        </Link>

        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
            REVV / VEHICLE MANAGEMENT
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <h1 className="text-4xl font-black">
              Edit Vehicle
            </h1>

            {isAdmin && (
              <span className="rounded-lg border border-blue-500/30 bg-blue-600/15 px-3 py-1 text-xs font-bold uppercase text-blue-300">
                Admin Access
              </span>
            )}
          </div>

          <p className="mt-3 text-zinc-400">
            Listing #{id} — {vehicle.year} {vehicle.make}{" "}
            {vehicle.model}
          </p>

          {isAdmin && vehicle.owner_id === null && (
            <p className="mt-2 text-sm text-blue-300">
              This is an unassigned legacy listing. Admin access
              allows you to manage it.
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-7 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mt-7 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-300"
          >
            {success}
          </div>
        )}

        <form
          onSubmit={saveVehicle}
          className="mt-8 rounded-2xl border border-white/10 bg-[#101a2a] p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">
              Vehicle Details
            </h2>

            <span className="text-sm text-zinc-400">
              Current price: {formatPrice(vehicle.price_nzd)}
            </span>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            {(
              [
                ["make", "Make"],
                ["model", "Model"],
                ["year", "Year"],
                ["price_nzd", "Price (NZD)"],
                ["mileage_km", "Mileage (km)"],
                ["location", "Location"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="text-sm font-medium text-zinc-300"
              >
                {label}

                <input
                  required
                  type={
                    ["year", "price_nzd", "mileage_km"].includes(
                      key
                    )
                      ? "number"
                      : "text"
                  }
                  min={
                    key === "year"
                      ? 1900
                      : key === "price_nzd"
                        ? 1
                        : key === "mileage_km"
                          ? 0
                          : undefined
                  }
                  max={key === "year" ? 2100 : undefined}
                  step={
                    ["year", "price_nzd", "mileage_km"].includes(
                      key
                    )
                      ? 1
                      : undefined
                  }
                  value={form[key]}
                  onChange={(event) =>
                    updateField(key, event.target.value)
                  }
                  className={inputClass}
                />
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-7 rounded-xl bg-blue-600 px-7 py-3 font-bold hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save Vehicle Details"}
          </button>
        </form>

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#101a2a] p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
                REVV / MEDIA
              </p>

              <h2 className="mt-3 text-2xl font-bold">
                Manage Vehicle Photos
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                Upload, reorder, delete and choose a cover photo.
              </p>
            </div>

            <span className="rounded-xl bg-blue-600/15 px-4 py-2 font-semibold text-blue-300">
              {photos.length} / 10 Photos
            </span>
          </div>

          <div className="mt-7 rounded-xl border border-dashed border-white/20 bg-[#0c1523] p-6">
            <h3 className="font-bold">Upload Photos</h3>

            <p className="mt-2 text-sm text-zinc-400">
              JPG, PNG or WEBP. Maximum 5 MB per image,
              up to 10 images per vehicle.
            </p>

            <input
              key={fileInputKey}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              disabled={busy || photos.length >= 10}
              onChange={(event) =>
                setSelectedFiles(
                  Array.from(event.target.files ?? [])
                )
              }
              className="mt-5 block w-full text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:font-semibold file:text-white"
            />

            {selectedFiles.length > 0 && (
              <p className="mt-3 text-sm text-zinc-400">
                {selectedFiles.length} photo(s) selected
              </p>
            )}

            <button
              type="button"
              disabled={busy || selectedFiles.length === 0}
              onClick={() => void uploadPhotos()}
              className="mt-5 rounded-xl bg-blue-600 px-6 py-3 font-bold hover:bg-blue-500 disabled:opacity-50"
            >
              {busy ? "Processing..." : "Upload Photos"}
            </button>
          </div>

          {photos.length === 0 ? (
            <div className="mt-8 rounded-xl border border-white/10 p-10 text-center text-zinc-400">
              No photos uploaded for this vehicle yet.
            </div>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {photos.map((photo, index) => (
                <article
                  key={photo.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-[#111c2d]"
                >
                  <div className="relative h-48 bg-[#172438]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={new URL(photo.url, API).toString()}
                      alt={`Vehicle photo ${index + 1}`}
                      className="h-full w-full object-cover"
                    />

                    {photo.is_cover && (
                      <span className="absolute left-3 top-3 rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold">
                        Cover Photo
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 p-4">
                    <p className="text-sm text-zinc-400">
                      Photo {index + 1}
                    </p>

                    <button
                      type="button"
                      disabled={busy || photo.is_cover}
                      onClick={() => void setCover(photo)}
                      className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                    >
                      {photo.is_cover
                        ? "Current Cover"
                        : "Set as Cover"}
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busy || index === 0}
                        onClick={() => void movePhoto(index, -1)}
                        className="rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-40"
                      >
                        ← Left
                      </button>

                      <button
                        type="button"
                        disabled={
                          busy || index === photos.length - 1
                        }
                        onClick={() => void movePhoto(index, 1)}
                        className="rounded-lg border border-white/20 px-3 py-2 text-sm disabled:opacity-40"
                      >
                        Right →
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void deletePhoto(photo)}
                      className="w-full rounded-lg border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                    >
                      Delete Photo
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href={`/cars/${id}`}
            className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
          >
            View Public Listing
          </Link>

          <Link
            href={backLink}
            className="rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/10"
          >
            {isAdmin ? "Admin Dashboard" : "My Listings"}
          </Link>
        </div>
      </div>
    </main>
  );
}
