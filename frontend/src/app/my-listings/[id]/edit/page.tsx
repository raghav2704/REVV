"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import VehiclePhotoUploader from "@/components/VehiclePhotoUploader";
import VehicleSpecificationsFields, {
  emptyVehicleSpecifications,
  type VehicleSpecifications,
} from "@/components/VehicleSpecificationsFields";

const API = typeof window === "undefined" ? "http://127.0.0.1:8000" : window.location.origin;

type Vehicle = {
  id: number;
  make: string;
  model: string;
  year: number;
  price_nzd: number;
  mileage_km: number;
  location: string;
  owner_id?: number | null;
} & Partial<VehicleSpecifications>;

type Account = {
  id: number;
  role: string;
  full_name?: string;
};

type VehiclePhoto = {
  id: number;
  url: string;
  is_cover: boolean;
  position: number;
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
  "mt-2 w-full rounded-xl border border-white/10 bg-[#0b1424] px-4 py-3 text-sm text-white outline-none focus:border-blue-500";

function unwrap<T>(value: T | { data: T }): T {
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
    throw new Error("Your session has expired. Please log in again.");
  }

  if (response.status === 403) {
    throw new Error("You do not have permission to manage this vehicle.");
  }

  if (response.status === 404) {
    throw new Error("Vehicle not found.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);

    const detail = body?.detail;
    const reason = typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? detail.map((issue: { loc?: unknown[]; msg?: string }) =>
            `${Array.isArray(issue.loc) ? issue.loc.join(".") : "Field"}: ${issue.msg ?? "Invalid value"}`
          ).join("; ")
        : `Request failed (${response.status}).`;
    throw new Error(reason);
  }
}

function sortPhotos(images: VehiclePhoto[]) {
  return [...images].sort(
    (a, b) => a.position - b.position || a.id - b.id
  );
}

export default function EditVehiclePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [account, setAccount] = useState<Account | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleForm | null>(null);
  const [specifications, setSpecifications] = useState<VehicleSpecifications>(
    emptyVehicleSpecifications
  );

  const [photos, setPhotos] = useState<VehiclePhoto[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isAdmin = account?.role === "admin";

  const canEdit =
    account !== null &&
    vehicle !== null &&
    (isAdmin || vehicle.owner_id === account.id || vehicle.owner_id === undefined);

  // Ownership is checked using the authenticated inventory endpoint at load.

  const backLink = isAdmin ? "/admin" : "/my-listings";

  const loadPhotos = useCallback(async () => {
    const response = await fetch(
      `${API}/api/v1/cars/${id}/images`,
      { cache: "no-store" }
    );

    await checkResponse(response);

    const result: { images: VehiclePhoto[] } | {
      data: { images: VehiclePhoto[] };
    } = await response.json();

    const gallery = unwrap(result);

    if (!Array.isArray(gallery.images)) {
      throw new Error("Unexpected vehicle photo response.");
    }

    setPhotos(sortPhotos(gallery.images));
  }, [id]);

  useEffect(() => {
    let active = true;

    async function loadVehicle() {
      setLoading(true);
      setError("");

      try {
        const [accountResponse, vehicleResponse, photosResponse] =
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
        await checkResponse(photosResponse);

        const currentAccount = unwrap<Account>(
          await accountResponse.json()
        );

        // Owners must be resolved through the authenticated inventory API.
        // The public serializer intentionally does not return owner_id.
        const inventoryResponse = await fetch(`${API}/api/v1/my/cars`, {
          credentials: "include",
          cache: "no-store",
        });
        const inventory = inventoryResponse.ok
          ? unwrap<Vehicle[]>(await inventoryResponse.json())
          : [];
        const ownedVehicle = Array.isArray(inventory)
          ? inventory.find((item) => item.id === Number(id))
          : undefined;

        const currentVehicle = ownedVehicle ?? (
          vehicleResponse.ok
            ? unwrap<Vehicle>(await vehicleResponse.json())
            : null
        );

        const gallery = unwrap<{ images: VehiclePhoto[] }>(
          await photosResponse.json()
        );

        if (
          !currentAccount ||
          !Number.isInteger(currentAccount.id) ||
          !currentVehicle ||
          !Number.isInteger(currentVehicle.id)
        ) {
          throw new Error("Invalid account or vehicle data.");
        }

        if (
          currentAccount.role !== "admin" &&
          !ownedVehicle
        ) {
          throw new Error(
            "You are not authorised to edit this listing."
          );
        }

        if (!Array.isArray(gallery.images)) {
          throw new Error("Invalid vehicle photo data.");
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

        setSpecifications({
          ...emptyVehicleSpecifications,
          ...Object.fromEntries(
            Object.keys(emptyVehicleSpecifications).map((key) => [
              key,
              currentVehicle[key as keyof VehicleSpecifications] ?? null,
            ])
          ),
        } as VehicleSpecifications);
        setPhotos(sortPhotos(gallery.images));
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load the vehicle."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadVehicle();

    return () => {
      active = false;
    };
  }, [id]);

  function updateField(
    field: keyof VehicleForm,
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
      const payload = {
        make: form.make.trim(),
        model: form.model.trim(),
        year,
        price_nzd: price,
        mileage_km: mileage,
        location: form.location.trim(),
        ...specifications,
      };

      const response = await fetch(
        `${API}/api/v1/cars/${id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      await checkResponse(response);

      // The PATCH response contains the committed vehicle, including drafts.
      // The public GET /api/v1/cars/{id} intentionally returns 404 for
      // unpublished vehicles, so it must not be used to verify draft saves.
      const saved = unwrap<Vehicle>(await response.json());

      if (!saved || saved.id !== Number(id)) {
        throw new Error("The server returned an unexpected vehicle record.");
      }

      const unpersisted = Object.entries(payload).filter(([key, value]) => {
        const actual = saved[key as keyof Vehicle];
        return (actual ?? null) !== (value ?? null);
      });

      if (unpersisted.length > 0) {
        throw new Error(
          `The server accepted the update but returned different values for: ${unpersisted.map(([key]) => key).join(", ")}. Check the FastAPI PATCH handler and vehicle serializer.`
        );
      }

      setVehicle(saved);
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
      setError("Maximum 10 photos per vehicle.");
      return;
    }

    if (
      selectedFiles.some(
        (file) =>
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024
      )
    ) {
      setError("Only JPG, PNG or WEBP images up to 5 MB are allowed.");
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
      setSelectedFiles([]);
      await loadPhotos();

      setSuccess("Photos uploaded successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload photos."
      );
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto(photo: VehiclePhoto) {
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

  async function setCover(photo: VehiclePhoto) {
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
          : "Unable to update cover photo."
      );
    } finally {
      setBusy(false);
    }
  }

  async function movePhoto(index: number, direction: -1 | 1) {
    const target = index + direction;

    if (
      !canEdit ||
      busy ||
      target < 0 ||
      target >= photos.length
    ) {
      return;
    }

    const ordered = [...photos];

    [ordered[index], ordered[target]] = [
      ordered[target],
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
      <main className="min-h-screen bg-[#080f1c] px-6 py-20 text-center text-white">
        Loading vehicle details...
      </main>
    );
  }

  if (!form || !canEdit || !vehicle) {
    return (
      <main className="min-h-screen bg-[#080f1c] px-6 py-20 text-center text-white">
        <h1 className="text-3xl font-bold">
          Unable to Edit Vehicle
        </h1>

        <p role="alert" className="mt-4 text-red-300">
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
    <main className="min-h-screen bg-[#080f1c] px-5 py-12 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href={backLink}
          className="text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          ← Back to {isAdmin ? "Admin Dashboard" : "Your Garage"}
        </Link>

        <header className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
            REVV / VEHICLE MANAGEMENT
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <h1 className="text-4xl font-black tracking-tight">
              Edit Vehicle
            </h1>

            {isAdmin && (
              <span className="rounded-lg border border-blue-500/30 bg-blue-600/15 px-3 py-1 text-xs font-semibold text-blue-300">
                Admin Access
              </span>
            )}
          </div>

          <p className="mt-3 text-slate-400">
            Listing #{id} — {vehicle.year} {vehicle.make}{" "}
            {vehicle.model}
          </p>
        </header>

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
          className="mt-8 rounded-2xl border border-white/10 bg-[#111c2e] p-6 sm:p-8"
        >
          <div>
            <h2 className="text-2xl font-bold">
              Vehicle Details
            </h2>

            <p className="mt-2 text-sm text-slate-400">
              Update your vehicle's information and asking price.
            </p>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            {(
              [
                ["make", "Make"],
                ["model", "Model"],
                ["year", "Year"],
                ["price_nzd", "Asking Price (NZD)"],
                ["mileage_km", "Mileage (km)"],
                ["location", "Location"],
              ] as const
            ).map(([field, label]) => (
              <label
                key={field}
                className="text-sm font-medium text-slate-300"
              >
                {label}

                <input
                  required
                  type={
                    ["year", "price_nzd", "mileage_km"].includes(field)
                      ? "number"
                      : "text"
                  }
                  min={
                    field === "year"
                      ? 1900
                      : field === "price_nzd"
                        ? 1
                        : field === "mileage_km"
                          ? 0
                          : undefined
                  }
                  max={field === "year" ? 2100 : undefined}
                  step={
                    ["year", "price_nzd", "mileage_km"].includes(field)
                      ? 1
                      : undefined
                  }
                  value={form[field]}
                  onChange={(event) =>
                    updateField(field, event.target.value)
                  }
                  className={inputClass}
                />
              </label>
            ))}
          </div>

          <div className="mt-8">
            <VehicleSpecificationsFields
              value={specifications}
              onChange={(next) => {
                setSpecifications(next);
                setSuccess("");
              }}
              disabled={busy}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="mt-7 rounded-xl bg-blue-600 px-7 py-3 text-sm font-bold hover:bg-blue-500 disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save Vehicle Details"}
          </button>
        </form>

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#111c2e] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
                REVV / MEDIA
              </p>

              <h2 className="mt-3 text-2xl font-bold">
                Manage Vehicle Photos
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Add photos, select a cover and arrange your gallery.
              </p>
            </div>

            <span className="rounded-xl bg-blue-600/15 px-4 py-2 text-sm font-semibold text-blue-300">
              {photos.length} / 10 Uploaded
            </span>
          </div>

          <div className="mt-7">
            <VehiclePhotoUploader
              files={selectedFiles}
              onChange={setSelectedFiles}
              remainingSlots={10 - photos.length}
              disabled={busy}
            />

            {selectedFiles.length > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void uploadPhotos()}
                className="mt-5 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold hover:bg-blue-500 disabled:opacity-50"
              >
                {busy
                  ? "Uploading..."
                  : `Upload ${selectedFiles.length} Photo${selectedFiles.length === 1 ? "" : "s"}`}
              </button>
            )}
          </div>

          <div className="mt-10 border-t border-white/10 pt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-bold">
                Uploaded Photos
              </h3>

              <p className="text-sm text-slate-400">
                {photos.length} images
              </p>
            </div>

            {photos.length === 0 ? (
              <div className="mt-5 rounded-xl border border-white/10 bg-[#0b1424] p-10 text-center text-sm text-slate-400">
                No photos uploaded yet.
              </div>
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {photos.map((photo, index) => (
                  <article
                    key={photo.id}
                    className="overflow-hidden rounded-xl border border-white/10 bg-[#0b1424]"
                  >
                    <div className="relative h-44 overflow-hidden bg-[#172438]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={new URL(photo.url, API).toString()}
                        alt={`Uploaded vehicle photo ${index + 1}`}
                        className="h-full w-full object-cover"
                      />

                      {photo.is_cover && (
                        <span className="absolute left-3 top-3 rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold">
                          Cover Photo
                        </span>
                      )}
                    </div>

                    <div className="space-y-3 p-4">
                      <p className="text-xs text-slate-400">
                        Photo {index + 1}
                      </p>

                      <button
                        type="button"
                        disabled={busy || photo.is_cover}
                        onClick={() => void setCover(photo)}
                        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
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
                          className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-30"
                        >
                          ← Left
                        </button>

                        <button
                          type="button"
                          disabled={
                            busy || index === photos.length - 1
                          }
                          onClick={() => void movePhoto(index, 1)}
                          className="rounded-lg border border-white/15 px-3 py-2 text-sm disabled:opacity-30"
                        >
                          Right →
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void deletePhoto(photo)}
                        className="w-full rounded-lg border border-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                      >
                        Delete Photo
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/cars/${id}`}
            className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold hover:bg-blue-500"
          >
            View Public Listing
          </Link>

          <Link
            href={backLink}
            className="rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold hover:bg-white/10"
          >
            {isAdmin ? "Admin Dashboard" : "Your Garage"}
          </Link>
        </div>
      </div>
    </main>
  );
}
