"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import VehiclePhotoUploader from "@/components/VehiclePhotoUploader";
import VehicleSpecificationsFields, {
  emptyVehicleSpecifications,
  type VehicleSpecifications,
} from "@/components/VehicleSpecificationsFields";

const API = "";

type Make = {
  id: number;
  name: string;
};

type Model = {
  id: number;
  make_id: number;
  name: string;
};

type FormValues = {
  make: string;
  model: string;
  year: string;
  mileage_km: string;
  price_nzd: string;
  location: string;
};

const initialValues: FormValues = {
  make: "",
  model: "",
  year: "",
  mileage_km: "",
  price_nzd: "",
  location: "",
};

const inputClass =
  "w-full min-h-12 rounded-xl border border-[#30415D] bg-[#111E32] px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";

const labelClass =
  "mb-2 block text-sm font-semibold text-slate-200";

const sectionClass =
  "overflow-hidden rounded-3xl border border-white/10 bg-[#0E1A2C] shadow-xl";

function getError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;

  const record = data as Record<string, unknown>;

  if (typeof record.detail === "string") {
    return record.detail;
  }

  if (Array.isArray(record.detail)) {
    return record.detail
      .map((item: unknown) => {
        if (
          item &&
          typeof item === "object" &&
          "msg" in item
        ) {
          return String(item.msg);
        }
        return "Invalid field";
      })
      .join(", ");
  }

  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractId(data: unknown): number {
  if (!data || typeof data !== "object") {
    throw new Error(
      "The server response was unexpected. Check Your Garage before retrying."
    );
  }

  const result = data as Record<string, unknown>;
  const nested =
    result.data &&
    typeof result.data === "object" &&
    !Array.isArray(result.data)
      ? (result.data as Record<string, unknown>)
      : null;

  const id = Number(nested?.id ?? result.id);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(
      "Could not confirm the listing ID. Check Your Garage before retrying."
    );
  }

  return id;
}

function SectionHeader({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-white/10 bg-[#132239] px-6 py-6 sm:px-9">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white">
          {number}
        </div>

        <div>
          <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SellCarForm() {
  const [form, setForm] = useState<FormValues>(initialValues);
  const [specifications, setSpecifications] =
    useState<VehicleSpecifications>({ ...emptyVehicleSpecifications });

  const [makes, setMakes] = useState<Make[]>([]);
  const [models, setModels] = useState<Model[]>([]);

  const [makeSearch, setMakeSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");

  const [loadingMakes, setLoadingMakes] = useState(true);
  const [loadingModels, setLoadingModels] = useState(false);

  const [catalogueError, setCatalogueError] = useState("");
  const [modelError, setModelError] = useState("");

  const [manualMake, setManualMake] = useState(false);
  const [manualModel, setManualModel] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [createdId, setCreatedId] = useState<number | null>(
    null
  );
  const [complete, setComplete] = useState(false);
  const [uploadAttempted, setUploadAttempted] = useState(false);

  const currentYear = new Date().getFullYear();

  const selectedMakeId = useMemo(() => {
    if (manualMake || !form.make.trim()) return null;

    return (
      makes.find(
        (item) =>
          item.name.toLowerCase() ===
          form.make.trim().toLowerCase()
      )?.id ?? null
    );
  }, [makes, form.make, manualMake]);

  const filteredMakes = useMemo(
    () =>
      makes.filter((item) =>
        item.name
          .toLowerCase()
          .includes(makeSearch.toLowerCase().trim())
      ),
    [makes, makeSearch]
  );

  const filteredModels = useMemo(
    () =>
      models.filter((item) =>
        item.name
          .toLowerCase()
          .includes(modelSearch.toLowerCase().trim())
      ),
    [models, modelSearch]
  );

  // Load REVV manufacturers.
  useEffect(() => {
    const controller = new AbortController();

    async function loadMakes() {
      try {
        const response = await fetch(
          `${API}/api/v1/vehicle-makes`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Catalogue unavailable");
        }

        const data: unknown = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid catalogue response");
        }

        if (!controller.signal.aborted) {
          setMakes(data as Make[]);
        }
      } catch {
        if (!controller.signal.aborted) {
          setCatalogueError(
            "The catalogue couldn't be loaded. Enter your manufacturer manually."
          );
          setManualMake(true);
          setManualModel(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingMakes(false);
        }
      }
    }

    void loadMakes();
    return () => controller.abort();
  }, []);

  // Load models for the selected manufacturer.
  useEffect(() => {
    const controller = new AbortController();

    if (selectedMakeId === null) {
      setModels([]);
      setModelError("");
      setLoadingModels(false);
      return () => controller.abort();
    }

    async function loadModels(makeId: number) {
      setLoadingModels(true);
      setModelError("");
      setModels([]);

      try {
        const response = await fetch(
          `${API}/api/v1/vehicle-makes/${makeId}/models`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Models unavailable");
        }

        const data: unknown = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid model response");
        }

        if (!controller.signal.aborted) {
          setModels(data as Model[]);
        }
      } catch {
        if (!controller.signal.aborted) {
          setModelError(
            "Models couldn't be loaded. Enter your model manually."
          );
          setManualModel(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingModels(false);
        }
      }
    }

    void loadModels(selectedMakeId);
    return () => controller.abort();
  }, [selectedMakeId]);

  function updateField(
    key: keyof FormValues,
    value: string
  ) {
    if (createdId !== null) return;

    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  function selectMake(value: string) {
    if (createdId !== null) return;

    setForm((previous) => ({
      ...previous,
      make: value,
      model: "",
    }));

    setModelSearch("");
    setManualModel(false);
  }

  function validate(): string | null {
    if (
      !form.make.trim() ||
      !form.model.trim() ||
      !form.location.trim()
    ) {
      return "Please complete all required fields.";
    }

    if (
      [form.make, form.model, form.location].some(
        (value) => value.trim().length > 100
      )
    ) {
      return "Vehicle details cannot exceed 100 characters.";
    }

    const year = Number(form.year);
    const price = Number(form.price_nzd);
    const mileage = Number(form.mileage_km);

    if (
      !form.year.trim() ||
      !Number.isInteger(year) ||
      year < 1900 ||
      year > currentYear + 1
    ) {
      return "Enter a valid vehicle year.";
    }

    if (
      !form.price_nzd.trim() ||
      !Number.isInteger(price) ||
      price <= 0
    ) {
      return "Enter a valid asking price.";
    }

    if (
      !form.mileage_km.trim() ||
      !Number.isInteger(mileage) ||
      mileage < 0
    ) {
      return "Enter valid vehicle mileage.";
    }

    return null;
  }

  async function uploadPhotos(vehicleId: number) {
    if (files.length === 0) return;

    const body = new FormData();

    for (const file of files) {
      body.append("files", file);
    }

    const response = await fetch(
      `${API}/api/v1/cars/${vehicleId}/images`,
      {
        method: "POST",
        credentials: "include",
        body,
      }
    );

    if (!response.ok) {
      const data = await readJson(response);

      throw new Error(
        getError(
          data,
          "The listing was created, but the photo upload failed."
        )
      );
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting || complete) return;

    setError("");

    if (createdId === null) {
      const validationError = validate();

      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setSubmitting(true);
    let vehicleId = createdId;

    try {
      if (vehicleId === null) {
        const response = await fetch(
          `${API}/api/v1/cars`,
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              make: form.make.trim(),
              model: form.model.trim(),
              year: Number(form.year),
              mileage_km: Number(form.mileage_km),
              price_nzd: Number(form.price_nzd),
              location: form.location.trim(),
              ...specifications,
            }),
          }
        );

        const data = await readJson(response);

        if (!response.ok) {
          throw new Error(
            getError(
              data,
              response.status === 401
                ? "Please sign in before listing a vehicle."
                : "Couldn't create your listing."
            )
          );
        }

        vehicleId = extractId(data);
        setCreatedId(vehicleId);
      }

      // Avoid blindly repeating an upload if a previous
      // request may already have succeeded.
      if (uploadAttempted) {
        throw new Error(
          "Photo upload was already attempted. Check your listing in Your Garage and manage its photos there."
        );
      }

      setUploadAttempted(true);
      await uploadPhotos(vehicleId);

      setComplete(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (complete && createdId !== null) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#0E1A2C] p-8 text-center text-white shadow-xl sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-600/20 text-3xl font-bold text-blue-300">
          ✓
        </div>

        <h2 className="mt-6 text-3xl font-black">
          Vehicle listed successfully!
        </h2>

        <p className="mt-3 text-slate-300">
          Your {form.year} {form.make} {form.model} has
          been added to REVV.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/cars/${createdId}`}
            className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-500"
          >
            View listing
          </Link>

          <Link
            href="/my-listings"
            className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 font-bold text-white transition hover:bg-white/10"
          >
            Your Garage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-5xl space-y-7 text-white"
    >
      {/* HERO */}

      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0B1628] p-7 sm:p-10">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl" />

        <div className="relative">
          <span className="inline-flex rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-300">
            REVV MARKETPLACE
          </span>

          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
            Sell your vehicle.
            <span className="mt-1 block text-blue-300">
              The smarter way.
            </span>
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
            List your vehicle with confidence. Add
            accurate details, showcase your photos,
            and reach buyers through REVV.
          </p>
        </div>
      </header>

      {/* VEHICLE DETAILS */}

      <section className={sectionClass}>
        <SectionHeader
          number="01"
          title="Vehicle details"
          description="Tell us about the car you're selling."
        />

        {catalogueError && (
          <div
            role="alert"
            className="mx-6 mt-6 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200 sm:mx-9"
          >
            {catalogueError}
          </div>
        )}

        <div className="grid gap-6 p-6 md:grid-cols-2 sm:p-9">
          {/* MANUFACTURER */}

          <div>
            <label htmlFor="revv-make" className={labelClass}>
              Manufacturer *
            </label>

            {manualMake ? (
              <div className="space-y-2">
                <input
                  id="revv-make"
                  required
                  maxLength={100}
                  disabled={createdId !== null}
                  value={form.make}
                  onChange={(event) =>
                    selectMake(event.target.value)
                  }
                  placeholder="Enter manufacturer"
                  className={inputClass}
                />

                {makes.length > 0 && (
                  <button
                    type="button"
                    disabled={createdId !== null}
                    onClick={() => {
                      setManualMake(false);
                      selectMake("");
                    }}
                    className="text-xs font-bold text-blue-300 hover:text-white"
                  >
                    Back to manufacturer list
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="search"
                  aria-label="Search manufacturers"
                  placeholder="Search manufacturers..."
                  value={makeSearch}
                  disabled={createdId !== null}
                  onChange={(event) =>
                    setMakeSearch(event.target.value)
                  }
                  className={inputClass}
                />

                <select
                  id="revv-make"
                  required
                  value={form.make}
                  disabled={loadingMakes || createdId !== null}
                  onChange={(event) => {
                    if (event.target.value === "__manual") {
                      setManualMake(true);
                      selectMake("");
                    } else {
                      selectMake(event.target.value);
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">
                    {loadingMakes
                      ? "Loading manufacturers..."
                      : "Select manufacturer"}
                  </option>

                  {filteredMakes
                    .filter((item) => item.name !== "Other")
                    .map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}

                  {form.make &&
                    !filteredMakes.some(
                      (item) => item.name === form.make
                    ) && (
                      <option value={form.make}>
                        {form.make}
                      </option>
                    )}

                  <option value="__manual">
                    Other / Enter manually
                  </option>
                </select>
              </div>
            )}
          </div>

          {/* MODEL */}

          <div>
            <label htmlFor="revv-model" className={labelClass}>
              Model *
            </label>

            {manualMake ||
            manualModel ||
            selectedMakeId === null ? (
              <div className="space-y-2">
                <input
                  id="revv-model"
                  required
                  maxLength={100}
                  value={form.model}
                  disabled={
                    !form.make.trim() ||
                    createdId !== null
                  }
                  onChange={(event) =>
                    updateField("model", event.target.value)
                  }
                  placeholder={
                    form.make
                      ? "Enter vehicle model"
                      : "Select manufacturer first"
                  }
                  className={inputClass}
                />

                {!manualMake &&
                  manualModel &&
                  selectedMakeId !== null && (
                    <button
                      type="button"
                      disabled={createdId !== null}
                      onClick={() => {
                        setManualModel(false);
                        updateField("model", "");
                      }}
                      className="text-xs font-bold text-blue-300 hover:text-white"
                    >
                      Back to model list
                    </button>
                  )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="search"
                  aria-label="Search models"
                  placeholder="Search vehicle models..."
                  value={modelSearch}
                  disabled={createdId !== null}
                  onChange={(event) =>
                    setModelSearch(event.target.value)
                  }
                  className={inputClass}
                />

                <select
                  id="revv-model"
                  required
                  value={form.model}
                  disabled={
                    loadingModels || createdId !== null
                  }
                  onChange={(event) => {
                    if (event.target.value === "__manual") {
                      setManualModel(true);
                      updateField("model", "");
                    } else {
                      updateField("model", event.target.value);
                    }
                  }}
                  className={inputClass}
                >
                  <option value="">
                    {loadingModels
                      ? "Loading models..."
                      : "Select model"}
                  </option>

                  {filteredModels.map((item) => (
                    <option key={item.id} value={item.name}>
                      {item.name}
                    </option>
                  ))}

                  {form.model &&
                    !filteredModels.some(
                      (item) => item.name === form.model
                    ) && (
                      <option value={form.model}>
                        {form.model}
                      </option>
                    )}

                  <option value="__manual">
                    Other / Enter manually
                  </option>
                </select>

                {!loadingModels && models.length === 0 && (
                  <p className="text-xs text-slate-400">
                    No models listed? Choose Other and enter manually.
                  </p>
                )}
              </div>
            )}

            {modelError && (
              <p role="alert" className="mt-2 text-xs text-amber-300">
                {modelError}
              </p>
            )}
          </div>

          {/* YEAR */}

          <div>
            <label htmlFor="revv-year" className={labelClass}>
              Year *
            </label>

            <input
              id="revv-year"
              required
              type="number"
              min={1900}
              max={currentYear + 1}
              value={form.year}
              disabled={createdId !== null}
              onChange={(event) =>
                updateField("year", event.target.value)
              }
              placeholder="e.g. 2022"
              className={inputClass}
            />
          </div>

          {/* MILEAGE */}

          <div>
            <label htmlFor="revv-mileage" className={labelClass}>
              Mileage (km) *
            </label>

            <input
              id="revv-mileage"
              required
              type="number"
              min={0}
              step={1}
              value={form.mileage_km}
              disabled={createdId !== null}
              onChange={(event) =>
                updateField("mileage_km", event.target.value)
              }
              placeholder="e.g. 35000"
              className={inputClass}
            />
          </div>

          {/* PRICE */}

          <div>
            <label htmlFor="revv-price" className={labelClass}>
              Asking price (NZD) *
            </label>

            <input
              id="revv-price"
              required
              type="number"
              min={1}
              step={1}
              value={form.price_nzd}
              disabled={createdId !== null}
              onChange={(event) =>
                updateField("price_nzd", event.target.value)
              }
              placeholder="e.g. 34999"
              className={inputClass}
            />
          </div>

          {/* LOCATION */}

          <div>
            <label htmlFor="revv-location" className={labelClass}>
              Location *
            </label>

            <input
              id="revv-location"
              required
              maxLength={100}
              value={form.location}
              disabled={createdId !== null}
              onChange={(event) =>
                updateField("location", event.target.value)
              }
              placeholder="e.g. Auckland"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* VEHICLE SPECIFICATIONS */}

      <VehicleSpecificationsFields
        value={specifications}
        onChange={setSpecifications}
        disabled={submitting || createdId !== null}
      />

      {/* PHOTO UPLOADER */}

      <section className={sectionClass}>
        <SectionHeader
          number="03"
          title="Vehicle photos"
          description="Showcase your vehicle from every angle."
        />

        <div className="p-6 sm:p-9">
          <VehiclePhotoUploader
            files={files}
            onChange={setFiles}
            remainingSlots={10}
            disabled={submitting || createdId !== null}
          />

          <p className="mt-4 text-xs leading-6 text-slate-400">
            Upload up to 10 JPG, PNG or WEBP photos,
            maximum 5 MB each. Put your best photo first.
          </p>
        </div>
      </section>

      {/* ERRORS */}

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-400/30 bg-red-950/40 p-5 text-sm text-red-200"
        >
          {error}
        </div>
      )}

      {createdId !== null && !complete && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-950/30 p-5 text-sm text-amber-100">
          <p className="font-bold">
            Your listing #{createdId} was created.
          </p>

          <p className="mt-2">
            If photo upload failed, check the listing before
            uploading again. We won't create a duplicate vehicle.
          </p>

          <Link
            href={`/my-listings/${createdId}/edit`}
            className="mt-3 inline-block font-semibold text-blue-300 underline"
          >
            Manage listing photos
          </Link>
        </div>
      )}

      {/* PUBLISH */}

      <section className="flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-white/10 bg-[#0E1A2C] p-6 shadow-xl sm:p-8">
        <div>
          <h3 className="text-lg font-bold text-white">
            Ready to publish?
          </h3>

          <p className="mt-1 text-sm text-slate-400">
            Review your vehicle details and photos before publishing.
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || createdId !== null}
          className="inline-flex min-h-14 items-center justify-center rounded-xl bg-blue-600 px-8 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transform-none"
        >
          {submitting
            ? "Publishing..."
            : createdId !== null
              ? "Listing created"
              : "Publish Vehicle →"}
        </button>
      </section>
    </form>
  );
}
