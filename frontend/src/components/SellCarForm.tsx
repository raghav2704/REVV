
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import VehiclePhotoUploader from "@/components/VehiclePhotoUploader";

const API = "http://127.0.0.1:8000";

type VehicleForm = {
  make: string;
  model: string;
  year: string;
  price_nzd: string;
  mileage_km: string;
  location: string;
};

type CreatedVehicle = {
  id: number;
};

const initialForm: VehicleForm = {
  make: "",
  model: "",
  year: "",
  price_nzd: "",
  mileage_km: "",
  location: "",
};

const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-[#0b1424] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500";

async function checkResponse(response: Response) {
  if (response.status === 401) {
    throw new Error(
      "Your session has expired. Please log in again."
    );
  }

  if (response.status === 403) {
    throw new Error(
      "You do not have permission to perform this action."
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);

    let message = `Request failed (${response.status}).`;

    if (typeof body?.detail === "string") {
      message = body.detail;
    } else if (Array.isArray(body?.detail)) {
      message = body.detail
        .map((item: { msg?: string }) => item.msg ?? "Invalid value")
        .join(". ");
    }

    throw new Error(message);
  }
}

function getCreatedId(result: unknown): number {
  if (!result || typeof result !== "object") {
    throw new Error("Invalid vehicle creation response.");
  }

  const response = result as Record<string, unknown>;

  const raw =
    "data" in response &&
    response.data !== null &&
    typeof response.data === "object"
      ? response.data
      : response;

  const vehicle = raw as Record<string, unknown>;
  const id = Number(vehicle.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(
      "Vehicle creation response did not contain a valid ID. Check Your Garage before trying again."
    );
  }

  return id;
}

export default function SellCarForm() {
  const router = useRouter();

  const [form, setForm] = useState<VehicleForm>(initialForm);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Keep the created ID so a failed photo upload can be retried
  // without creating a second vehicle listing.
  const [createdId, setCreatedId] = useState<number | null>(
    null
  );

  function updateField(
    field: keyof VehicleForm,
    value: string
  ) {
    if (createdId !== null) return;

    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setError("");
  }

  function validateForm() {
    const year = Number(form.year);
    const price = Number(form.price_nzd);
    const mileage = Number(form.mileage_km);

    if (
      !form.make.trim() ||
      !form.model.trim() ||
      !form.location.trim() ||
      !form.year.trim() ||
      !form.price_nzd.trim() ||
      !form.mileage_km.trim()
    ) {
      throw new Error("Please complete all vehicle details.");
    }

    if (
      !Number.isInteger(year) ||
      year < 1900 ||
      year > new Date().getFullYear() + 1
    ) {
      throw new Error("Please enter a valid vehicle year.");
    }

    if (!Number.isSafeInteger(price) || price <= 0) {
      throw new Error("Enter a valid asking price.");
    }

    if (!Number.isSafeInteger(mileage) || mileage < 0) {
      throw new Error("Enter a valid mileage.");
    }

    return {
      make: form.make.trim(),
      model: form.model.trim(),
      year,
      price_nzd: price,
      mileage_km: mileage,
      location: form.location.trim(),
    };
  }

  async function createVehicle(): Promise<number> {
    const payload = validateForm();

    const response = await fetch(`${API}/api/v1/cars`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    await checkResponse(response);

    const result: unknown = await response.json();
    return getCreatedId(result);
  }

  async function uploadPhotos(vehicleId: number) {
    if (selectedFiles.length === 0) return;

    if (selectedFiles.length > 10) {
      throw new Error("You can upload a maximum of 10 photos.");
    }

    for (const file of selectedFiles) {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(
          file.type
        )
      ) {
        throw new Error(
          `${file.name} is not a supported image format.`
        );
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error(
          `${file.name} is larger than the 5 MB limit.`
        );
      }
    }

    const body = new FormData();

    // The first photo is the initial cover image.
    selectedFiles.forEach((file) => {
      body.append("files", file);
    });

    const response = await fetch(
      `${API}/api/v1/cars/${vehicleId}/images`,
      {
        method: "POST",
        credentials: "include",
        body,
      }
    );

    await checkResponse(response);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError("");
    setSuccess("");

    let vehicleId = createdId;

    try {
      // Only create the vehicle once.
      if (vehicleId === null) {
        vehicleId = await createVehicle();
        setCreatedId(vehicleId);
      }

      // Upload selected images to the newly created vehicle.
      await uploadPhotos(vehicleId);

      setSelectedFiles([]);
      setSuccess("Your vehicle has been listed successfully!");

      router.push("/my-listings");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong.";

      if (vehicleId !== null) {
        setError(
          `Vehicle #${vehicleId} has been created, but the process could not finish: ${message} You can retry without creating another listing, or manage it in Your Garage.`
        );
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-7 text-white"
    >
      {/* VEHICLE DETAILS */}

      <section className="rounded-2xl border border-white/10 bg-[#111c2e] p-6 sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
            STEP 01 / VEHICLE INFORMATION
          </p>

          <h2 className="mt-3 text-2xl font-bold">
            Vehicle Details
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Tell buyers about your vehicle. Accurate information
            helps your listing stand out.
          </p>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-300">
            Make
            <input
              required
              type="text"
              maxLength={100}
              placeholder="e.g. BMW"
              value={form.make}
              disabled={busy || createdId !== null}
              onChange={(event) =>
                updateField("make", event.target.value)
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-slate-300">
            Model
            <input
              required
              type="text"
              maxLength={100}
              placeholder="e.g. 320i"
              value={form.model}
              disabled={busy || createdId !== null}
              onChange={(event) =>
                updateField("model", event.target.value)
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-slate-300">
            Year
            <input
              required
              type="number"
              min={1900}
              max={new Date().getFullYear() + 1}
              step={1}
              placeholder="e.g. 2022"
              value={form.year}
              disabled={busy || createdId !== null}
              onChange={(event) =>
                updateField("year", event.target.value)
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-slate-300">
            Asking Price (NZD)
            <input
              required
              type="number"
              min={1}
              step={1}
              placeholder="e.g. 35000"
              value={form.price_nzd}
              disabled={busy || createdId !== null}
              onChange={(event) =>
                updateField("price_nzd", event.target.value)
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-slate-300">
            Mileage (km)
            <input
              required
              type="number"
              min={0}
              step={1}
              placeholder="e.g. 50000"
              value={form.mileage_km}
              disabled={busy || createdId !== null}
              onChange={(event) =>
                updateField("mileage_km", event.target.value)
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-medium text-slate-300">
            Location
            <input
              required
              type="text"
              maxLength={100}
              placeholder="e.g. Auckland"
              value={form.location}
              disabled={busy || createdId !== null}
              onChange={(event) =>
                updateField("location", event.target.value)
              }
              className={inputClass}
            />
          </label>
        </div>

        {createdId !== null && (
          <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-sm text-blue-200">
            Vehicle #{createdId} is saved. Its details are
            locked here to avoid creating duplicate listings.
            You can edit them in Your Garage.
          </div>
        )}
      </section>

      {/* VEHICLE PHOTOS */}

      <section className="rounded-2xl border border-white/10 bg-[#111c2e] p-6 sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
            STEP 02 / VEHICLE PHOTOS
          </p>

          <h2 className="mt-3 text-2xl font-bold">
            Upload Vehicle Photos
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Drag and drop your photos or browse your files.
            Arrange them in the order buyers should see them.
          </p>
        </div>

        <div className="mt-7">
          <VehiclePhotoUploader
            files={selectedFiles}
            onChange={setSelectedFiles}
            remainingSlots={10}
            disabled={busy}
          />
        </div>

        <div className="mt-5 rounded-xl border border-white/10 bg-[#0b1424] p-4">
          <p className="text-sm font-semibold text-white">
            Photo tips
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Start with a clear front three-quarter exterior photo,
            then add the sides, rear, interior, dashboard and any
            visible wear or damage. Your first selected photo
            becomes the initial cover.
          </p>
        </div>
      </section>

      {/* ERRORS AND SUCCESS */}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm leading-6 text-red-200"
        >
          <p className="font-semibold">
            Could not finish listing
          </p>
          <p className="mt-2">{error}</p>

          {createdId !== null && (
            <Link
              href={`/my-listings/${createdId}/edit`}
              className="mt-3 inline-block font-semibold text-white underline underline-offset-4"
            >
              Manage saved vehicle
            </Link>
          )}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-xl border border-green-500/30 bg-green-500/10 p-5 text-sm text-green-200"
        >
          {success}
        </div>
      )}

      {/* SUBMIT */}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/my-listings"
          className="rounded-xl border border-white/15 px-6 py-3.5 text-center text-sm font-semibold text-slate-200 hover:bg-white/10"
        >
          Cancel
        </Link>

        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "Processing..."
            : createdId !== null
              ? selectedFiles.length > 0
                ? "Retry Photo Upload"
                : "Finish Listing"
              : "Publish Vehicle"}
        </button>
      </div>
    </form>
  );
}
