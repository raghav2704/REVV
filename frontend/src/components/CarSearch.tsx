
"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

const API = typeof window === "undefined" ? "http://127.0.0.1:8000" : window.location.origin;

export type VehiclePhoto = {
  id: number;
  url: string;
  is_cover: boolean;
  position: number;
};

export type Car = {
  id: number;
  make: string;
  model: string;
  year: number;
  price_nzd: number;
  mileage_km: number;
  location: string;
  variant?: string | null;
  body_type?: string | null;
  exterior_colour?: string | null;
  seats?: number | null;
  fuel_type?: string | null;
  transmission?: string | null;
  drivetrain?: string | null;
  engine_cc?: number | null;
  condition?: string | null;
  vehicle_origin?: string | null;
  description?: string | null;
  images?: VehiclePhoto[];
};

type VehicleMake = {
  id: number;
  name: string;
};

type VehicleModel = {
  id: number;
  make_id: number;
  name: string;
};

type SortOption =
  | "recent"
  | "price-low"
  | "price-high"
  | "year-new"
  | "year-old"
  | "mileage-low"
  | "mileage-high";

const inputClass =
  "w-full min-h-12 rounded-xl border border-[#30415D] bg-[#111E32] px-4 py-3 text-sm text-white placeholder:text-slate-400 outline-none transition hover:border-blue-400/50 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";

const SPEC_OPTIONS = {
  body_type: ["Sedan", "SUV", "Hatchback", "Wagon", "Coupe", "Convertible", "Ute", "Van", "People Mover", "Other"],
  fuel_type: ["Petrol", "Diesel", "Hybrid", "Plug-in Hybrid", "Electric", "Other"],
  transmission: ["Automatic", "Manual", "CVT", "Other"],
  drivetrain: ["FWD", "RWD", "AWD", "4WD", "Other"],
  condition: ["New", "Used", "Demonstrator"],
} as const;

type SpecFilter = keyof typeof SPEC_OPTIONS;

const labelClass =
  "mb-2 block text-xs font-bold uppercase tracking-[0.1em] text-slate-300";

function money(value: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);
}

function number(value: number): string {
  return new Intl.NumberFormat("en-NZ").format(value);
}

function photoUrl(url: string): string {
  try {
    return new URL(url, API).toString();
  } catch {
    return "";
  }
}

function coverPhoto(
  images: VehiclePhoto[] = []
): VehiclePhoto | undefined {
  const sorted = [...images].sort(
    (a, b) =>
      a.position - b.position || a.id - b.id
  );

  return (
    sorted.find((image) => image.is_cover) ??
    sorted[0]
  );
}

/* ============================================================
   VEHICLE GALLERY

   Preserved export for the existing vehicle detail pages.
============================================================ */

export function VehicleGallery({
  images,
  title,
}: {
  images: VehiclePhoto[];
  title: string;
}) {
  const sorted = useMemo(
    () =>
      [...images].sort(
        (a, b) =>
          a.position - b.position || a.id - b.id
      ),
    [images]
  );

  const [activeIndex, setActiveIndex] = useState(0);

  const coverIndex = Math.max(
    0,
    sorted.findIndex((image) => image.is_cover)
  );

  const selectedIndex =
    activeIndex >= 0 &&
    activeIndex < sorted.length
      ? activeIndex
      : coverIndex;

  if (sorted.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl border border-slate-200 bg-slate-100">
        <div className="text-center">
          <div className="text-5xl" aria-hidden="true">
            🚘
          </div>
          <p className="mt-3 text-sm font-medium text-slate-500">
            No vehicle photos available
          </p>
        </div>
      </div>
    );
  }

  const active = sorted[selectedIndex];

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-[#0B1628]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl(active.url)}
          alt={`${title} — photo ${selectedIndex + 1}`}
          className="aspect-video w-full object-contain"
        />

        <div className="absolute bottom-4 right-4 rounded-full border border-white/15 bg-black/70 px-4 py-2 text-xs font-bold text-white backdrop-blur-md">
          {selectedIndex + 1} / {sorted.length}
        </div>

        {sorted.length > 1 && (
          <>
            <button
              type="button"
              onClick={() =>
                setActiveIndex(
                  (selectedIndex - 1 + sorted.length) %
                    sorted.length
                )
              }
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-blue-600"
            >
              ←
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveIndex(
                  (selectedIndex + 1) % sorted.length
                )
              }
              aria-label="Next photo"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-blue-600"
            >
              →
            </button>
          </>
        )}
      </div>

      {sorted.length > 1 && (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
          {sorted.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`View photo ${index + 1}`}
              aria-pressed={selectedIndex === index}
              className={`overflow-hidden rounded-xl border-2 transition ${
                selectedIndex === index
                  ? "border-blue-500"
                  : "border-transparent hover:border-blue-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(image.url)}
                alt={`${title} thumbnail ${index + 1}`}
                className="aspect-square w-full bg-slate-100 object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   VEHICLE LISTING CARD
============================================================ */

function VehicleCard({ car }: { car: Car }) {
  const image = coverPhoto(car.images);
  const imageCount = car.images?.length ?? 0;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.14)] motion-reduce:transform-none">
      <Link
        href={`/cars/${car.id}`}
        aria-label={`View ${car.year} ${car.make} ${car.model}`}
        className="relative block h-56 overflow-hidden bg-[#111E32]"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl(image.url)}
            alt={`${car.year} ${car.make} ${car.model}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#142641] to-[#08111F] text-slate-400">
            <span className="text-5xl" aria-hidden="true">
              🚘
            </span>
            <span className="text-xs font-medium">
              Photos coming soon
            </span>
          </div>
        )}

        <span className="absolute left-3 top-3 rounded-lg border border-white/10 bg-[#0B1628]/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
          {car.year}
        </span>

        {imageCount > 0 && (
          <span className="absolute bottom-3 right-3 rounded-lg bg-black/65 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
            {imageCount} {imageCount === 1 ? "photo" : "photos"}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
            REVV MARKETPLACE
          </p>

          <h3 className="mt-2 line-clamp-2 text-xl font-extrabold tracking-tight text-[#0B1628]">
            {car.year} {car.make} {car.model}
          </h3>

          <p className="mt-4 text-2xl font-black tracking-tight text-blue-600">
            {money(car.price_nzd)}
          </p>

          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
            <div className="flex items-center gap-3">
              <span aria-hidden="true">◉</span>
              <span>{number(car.mileage_km)} km</span>
            </div>

            {(car.fuel_type || car.transmission || car.body_type) && (
              <p className="line-clamp-1 text-xs font-semibold text-slate-600">
                {[car.body_type, car.fuel_type, car.transmission].filter(Boolean).join(" · ")}
              </p>
            )}

            <div className="flex items-center gap-3">
              <span aria-hidden="true">⌖</span>
              <span className="truncate">
                {car.location || "Location unavailable"}
              </span>
            </div>
          </div>
        </div>

        <Link
          href={`/cars/${car.id}`}
          className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-[#0E1A2C] px-5 py-3 text-sm font-bold text-white transition-all duration-200 hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          View Vehicle →
        </Link>
      </div>
    </article>
  );
}

/* ============================================================
   ADVANCED MARKETPLACE SEARCH
============================================================ */

export default function CarSearch({
  cars,
}: {
  cars: Car[];
}) {
  const [makes, setMakes] = useState<VehicleMake[]>([]);
  const [models, setModels] = useState<VehicleModel[]>([]);

  const [catalogueError, setCatalogueError] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  const [search, setSearch] = useState("");

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");

  const [makeSearch, setMakeSearch] = useState("");
  const [modelSearch, setModelSearch] = useState("");

  const [minYear, setMinYear] = useState("");
  const [maxYear, setMaxYear] = useState("");

  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const [minMileage, setMinMileage] = useState("");
  const [maxMileage, setMaxMileage] = useState("");

  const [location, setLocation] = useState("");
  const [specFilters, setSpecFilters] = useState<Record<SpecFilter, string>>({
    body_type: "",
    fuel_type: "",
    transmission: "",
    drivetrain: "",
    condition: "",
  });

  function setSpecFilter(field: SpecFilter, value: string) {
    setSpecFilters((previous) => ({ ...previous, [field]: value }));
  }
  const [sort, setSort] = useState<SortOption>("recent");

  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedMakeId = useMemo(
    () =>
      makes.find(
        (item) =>
          item.name.toLowerCase() === make.toLowerCase()
      )?.id ?? null,
    [makes, make]
  );

  // Load manufacturers from the real REVV catalogue.
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
          setMakes(data as VehicleMake[]);
          setCatalogueError(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setCatalogueError(true);
        }
      }
    }

    void loadMakes();

    return () => controller.abort();
  }, []);

  // Load models only for the selected manufacturer.
  useEffect(() => {
    const controller = new AbortController();

    if (selectedMakeId === null) {
      setModels([]);
      setModelsLoading(false);
      return () => controller.abort();
    }

    async function loadModels(id: number) {
      setModelsLoading(true);
      setModels([]);

      try {
        const response = await fetch(
          `${API}/api/v1/vehicle-makes/${id}/models`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Models unavailable");
        }

        const data: unknown = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("Invalid models response");
        }

        if (!controller.signal.aborted) {
          setModels(data as VehicleModel[]);
        }
      } catch {
        if (!controller.signal.aborted) {
          setModels([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setModelsLoading(false);
        }
      }
    }

    void loadModels(selectedMakeId);

    return () => controller.abort();
  }, [selectedMakeId]);

  // Fallback makes are based on actual listings.
  const availableMakes = useMemo(() => {
    const names = new Set<string>();

    for (const item of makes) {
      if (item.name !== "Other") names.add(item.name);
    }

    for (const car of cars) {
      if (car.make.trim()) names.add(car.make.trim());
    }

    return [...names].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [makes, cars]);

  // Include both catalogue models and existing listing models.
  const availableModels = useMemo(() => {
    if (!make) return [];

    const names = new Set<string>();

    for (const item of models) {
      names.add(item.name);
    }

    for (const car of cars) {
      if (
        car.make.toLowerCase() === make.toLowerCase() &&
        car.model.trim()
      ) {
        names.add(car.model.trim());
      }
    }

    return [...names].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [models, cars, make]);

  const filteredMakes = useMemo(
    () =>
      availableMakes.filter((item) =>
        item.toLowerCase().includes(
          makeSearch.trim().toLowerCase()
        )
      ),
    [availableMakes, makeSearch]
  );

  const filteredModels = useMemo(
    () =>
      availableModels.filter((item) =>
        item.toLowerCase().includes(
          modelSearch.trim().toLowerCase()
        )
      ),
    [availableModels, modelSearch]
  );

  const locations = useMemo(
    () =>
      [...new Set(
        cars.map((car) => car.location.trim()).filter(Boolean)
      )].sort((a, b) => a.localeCompare(b)),
    [cars]
  );

  const currentYear = new Date().getFullYear();

  const yearOptions = useMemo(
    () =>
      Array.from(
        { length: currentYear + 2 - 1980 },
        (_, index) => currentYear + 1 - index
      ),
    [currentYear]
  );

  const filteredCars = useMemo(() => {
    const query = search.trim().toLowerCase();

    function matchesMin(value: number, min: string) {
      return (
        min.trim() === "" ||
        value >= Number(min)
      );
    }

    function matchesMax(value: number, max: string) {
      return (
        max.trim() === "" ||
        value <= Number(max)
      );
    }

    const results = cars.filter((car) => {
      const searchable = [
        car.make,
        car.model,
        car.year,
        car.location,
      ]
        .join(" ")
        .toLowerCase();

      if (query && !searchable.includes(query)) {
        return false;
      }

      if (
        make &&
        car.make.toLowerCase() !== make.toLowerCase()
      ) {
        return false;
      }

      if (
        model &&
        car.model.toLowerCase() !== model.toLowerCase()
      ) {
        return false;
      }

      if (
        location &&
        car.location !== location
      ) {
        return false;
      }

      if (
        (Object.keys(specFilters) as SpecFilter[]).some(
          (field) =>
            specFilters[field] !== "" &&
            (car[field] ?? "").toLowerCase() !== specFilters[field].toLowerCase()
        )
      ) {
        return false;
      }

      if (
        !matchesMin(car.price_nzd, minPrice) ||
        !matchesMax(car.price_nzd, maxPrice)
      ) {
        return false;
      }

      if (
        !matchesMin(car.year, minYear) ||
        !matchesMax(car.year, maxYear)
      ) {
        return false;
      }

      if (
        !matchesMin(car.mileage_km, minMileage) ||
        !matchesMax(car.mileage_km, maxMileage)
      ) {
        return false;
      }

      return true;
    });

    return [...results].sort((a, b) => {
      switch (sort) {
        case "price-low":
          return a.price_nzd - b.price_nzd;

        case "price-high":
          return b.price_nzd - a.price_nzd;

        case "year-new":
          return b.year - a.year || b.id - a.id;

        case "year-old":
          return a.year - b.year || a.id - b.id;

        case "mileage-low":
          return a.mileage_km - b.mileage_km;

        case "mileage-high":
          return b.mileage_km - a.mileage_km;

        default:
          // Current API does not expose a creation timestamp.
          // Higher listing IDs are treated as more recently added.
          return b.id - a.id;
      }
    });
  }, [
    cars,
    search,
    make,
    model,
    location,
    specFilters,
    minYear,
    maxYear,
    minPrice,
    maxPrice,
    minMileage,
    maxMileage,
    sort,
  ]);

  const hasFilters = Boolean(
    search ||
      make ||
      model ||
      location ||
      Object.values(specFilters).some(Boolean) ||
      minYear ||
      maxYear ||
      minPrice ||
      maxPrice ||
      minMileage ||
      maxMileage ||
      sort !== "recent"
  );

  const filterCount = [
    search,
    make,
    model,
    location,
    ...Object.values(specFilters),
    minYear,
    maxYear,
    minPrice,
    maxPrice,
    minMileage,
    maxMileage,
  ].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    setMake("");
    setModel("");
    setMakeSearch("");
    setModelSearch("");
    setMinYear("");
    setMaxYear("");
    setMinPrice("");
    setMaxPrice("");
    setMinMileage("");
    setMaxMileage("");
    setLocation("");
    setSpecFilters({body_type: "", fuel_type: "", transmission: "", drivetrain: "", condition: ""});
    setSort("recent");
  }

  function changeMake(value: string) {
    setMake(value);
    setModel("");
    setModelSearch("");
  }

  const invalidRange =
    (minPrice !== "" &&
      maxPrice !== "" &&
      Number(minPrice) > Number(maxPrice)) ||
    (minYear !== "" &&
      maxYear !== "" &&
      Number(minYear) > Number(maxYear)) ||
    (minMileage !== "" &&
      maxMileage !== "" &&
      Number(minMileage) > Number(maxMileage));

  return (
    <div className="space-y-8">
      {/* SEARCH PANEL */}

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#0E1A2C] text-white shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
        <div className="border-b border-white/10 bg-[#132239] px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-400">
                REVV VEHICLE FINDER
              </p>

              <h3 className="mt-2 text-2xl font-black tracking-tight text-white">
                Find your next drive.
              </h3>

              <p className="mt-2 text-sm text-slate-400">
                Search smarter with REVV's vehicle filters.
              </p>
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-bold text-blue-200 transition hover:bg-white/10"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="space-y-6 p-6 sm:p-8">
          {/* KEYWORD SEARCH */}

          <div>
            <label
              htmlFor="marketplace-search"
              className={labelClass}
            >
              Search vehicles
            </label>

            <input
              id="marketplace-search"
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search BMW, 320i, Toyota, Auckland..."
              className={inputClass}
            />
          </div>

          {/* MAIN FILTERS */}

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {/* MAKE */}

            <div>
              <label
                htmlFor="marketplace-make"
                className={labelClass}
              >
                Manufacturer
              </label>

              <input
                type="search"
                aria-label="Search manufacturers"
                value={makeSearch}
                onChange={(event) =>
                  setMakeSearch(event.target.value)
                }
                placeholder="Search makes..."
                className={`${inputClass} mb-2`}
              />

              <select
                id="marketplace-make"
                value={make}
                onChange={(event) =>
                  changeMake(event.target.value)
                }
                className={inputClass}
              >
                <option value="">All makes</option>

                {filteredMakes.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}

                {make &&
                  !filteredMakes.includes(make) && (
                    <option value={make}>{make}</option>
                  )}
              </select>
            </div>

            {/* MODEL */}

            <div>
              <label
                htmlFor="marketplace-model"
                className={labelClass}
              >
                Model
              </label>

              <input
                type="search"
                aria-label="Search models"
                value={modelSearch}
                disabled={!make}
                onChange={(event) =>
                  setModelSearch(event.target.value)
                }
                placeholder={
                  make
                    ? "Search models..."
                    : "Choose a make first"
                }
                className={`${inputClass} mb-2`}
              />

              <select
                id="marketplace-model"
                value={model}
                disabled={!make || modelsLoading}
                onChange={(event) =>
                  setModel(event.target.value)
                }
                className={inputClass}
              >
                <option value="">
                  {!make
                    ? "All models"
                    : modelsLoading
                      ? "Loading models..."
                      : "All models"}
                </option>

                {filteredModels.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}

                {model &&
                  !filteredModels.includes(model) && (
                    <option value={model}>{model}</option>
                  )}
              </select>
            </div>

            {/* PRICE MIN */}

            <div>
              <label
                htmlFor="marketplace-min-price"
                className={labelClass}
              >
                Min price (NZD)
              </label>

              <input
                id="marketplace-min-price"
                type="number"
                min={0}
                step={1000}
                value={minPrice}
                onChange={(event) =>
                  setMinPrice(event.target.value)
                }
                placeholder="No minimum"
                className={inputClass}
              />
            </div>

            {/* PRICE MAX */}

            <div>
              <label
                htmlFor="marketplace-max-price"
                className={labelClass}
              >
                Max price (NZD)
              </label>

              <input
                id="marketplace-max-price"
                type="number"
                min={0}
                step={1000}
                value={maxPrice}
                onChange={(event) =>
                  setMaxPrice(event.target.value)
                }
                placeholder="No maximum"
                className={inputClass}
              />
            </div>
          </div>

          {/* ADVANCED FILTER TOGGLE */}

          <button
            type="button"
            onClick={() =>
              setShowAdvanced((previous) => !previous)
            }
            aria-expanded={showAdvanced}
            className="flex w-full items-center justify-between rounded-xl border border-blue-400/20 bg-blue-500/10 px-5 py-4 text-left text-sm font-bold text-blue-200 transition hover:bg-blue-500/15"
          >
            <span>
              Advanced filters
              {filterCount > 0 && (
                <span className="ml-2 rounded-full bg-blue-600 px-2 py-0.5 text-[11px] text-white">
                  {filterCount} active
                </span>
              )}
            </span>

            <span aria-hidden="true">
              {showAdvanced ? "−" : "+"}
            </span>
          </button>

          {showAdvanced && (
            <div className="grid gap-5 rounded-2xl border border-white/10 bg-[#0A1628] p-5 md:grid-cols-2 xl:grid-cols-3">
              {/* YEAR MIN */}

              <div>
                <label
                  htmlFor="marketplace-min-year"
                  className={labelClass}
                >
                  Year from
                </label>

                <select
                  id="marketplace-min-year"
                  value={minYear}
                  onChange={(event) =>
                    setMinYear(event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Any year</option>

                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              {/* YEAR MAX */}

              <div>
                <label
                  htmlFor="marketplace-max-year"
                  className={labelClass}
                >
                  Year to
                </label>

                <select
                  id="marketplace-max-year"
                  value={maxYear}
                  onChange={(event) =>
                    setMaxYear(event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">Any year</option>

                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              {/* LOCATION */}

              <div>
                <label
                  htmlFor="marketplace-location"
                  className={labelClass}
                >
                  Location
                </label>

                <select
                  id="marketplace-location"
                  value={location}
                  onChange={(event) =>
                    setLocation(event.target.value)
                  }
                  className={inputClass}
                >
                  <option value="">All New Zealand</option>

                  {locations.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              {/* MILEAGE MIN */}

              <div>
                <label
                  htmlFor="marketplace-min-mileage"
                  className={labelClass}
                >
                  Min mileage (km)
                </label>

                <input
                  id="marketplace-min-mileage"
                  type="number"
                  min={0}
                  step={1000}
                  value={minMileage}
                  onChange={(event) =>
                    setMinMileage(event.target.value)
                  }
                  placeholder="No minimum"
                  className={inputClass}
                />
              </div>

              {/* MILEAGE MAX */}

              <div>
                <label
                  htmlFor="marketplace-max-mileage"
                  className={labelClass}
                >
                  Max mileage (km)
                </label>

                <input
                  id="marketplace-max-mileage"
                  type="number"
                  min={0}
                  step={1000}
                  value={maxMileage}
                  onChange={(event) =>
                    setMaxMileage(event.target.value)
                  }
                  placeholder="No maximum"
                  className={inputClass}
                />
              </div>

              {/* VEHICLE SPECIFICATIONS V2 */}
              {(
                [
                  ["body_type", "Body type"],
                  ["fuel_type", "Fuel type"],
                  ["transmission", "Transmission"],
                  ["drivetrain", "Drivetrain"],
                  ["condition", "Condition"],
                ] as const
              ).map(([field, label]) => (
                <div key={field}>
                  <label htmlFor={`marketplace-${field}`} className={labelClass}>
                    {label}
                  </label>
                  <select
                    id={`marketplace-${field}`}
                    value={specFilters[field]}
                    onChange={(event) => setSpecFilter(field, event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Any {label.toLowerCase()}</option>
                    {SPEC_OPTIONS[field].map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {catalogueError && (
            <p
              role="status"
              className="text-xs text-amber-300"
            >
              Manufacturer catalogue unavailable.
              Showing manufacturers from current listings.
            </p>
          )}

          {invalidRange && (
            <p
              role="alert"
              className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200"
            >
              A minimum value is greater than its maximum.
              Adjust the range to see matching vehicles.
            </p>
          )}

          {/* RESULTS SUMMARY */}

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
            <div>
              <p className="text-lg font-black text-white">
                {filteredCars.length}{" "}
                {filteredCars.length === 1
                  ? "vehicle found"
                  : "vehicles found"}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Filters update the listings instantly
              </p>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/10"
            >
              Reset all filters
            </button>
          </div>
        </div>
      </div>

      {/* SORT BAR */}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black tracking-tight text-[#0B1628]">
            Explore vehicles
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {filteredCars.length} of {cars.length} listings
          </p>
        </div>

        <label className="flex items-center gap-3 text-sm font-medium text-slate-600">
          Sort by

          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as SortOption)
            }
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-[#0B1628] outline-none focus:border-blue-500"
          >
            <option value="recent">
              Recently added
            </option>

            <option value="price-low">
              Price: Low to high
            </option>

            <option value="price-high">
              Price: High to low
            </option>

            <option value="year-new">
              Newest vehicle year
            </option>

            <option value="year-old">
              Oldest vehicle year
            </option>

            <option value="mileage-low">
              Lowest mileage
            </option>

            <option value="mileage-high">
              Highest mileage
            </option>
          </select>
        </label>
      </div>

      {/* RESULTS GRID */}

      {filteredCars.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCars.map((car) => (
            <VehicleCard key={car.id} car={car} />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <div
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-4xl"
            aria-hidden="true"
          >
            🚘
          </div>

          <h3 className="mt-6 text-2xl font-black text-[#0B1628]">
            No matching vehicles
          </h3>

          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">
            {cars.length === 0
              ? "There aren't any vehicles to display yet."
              : "Try adjusting your make, model, price, year, mileage, location or vehicle specifications filters."}
          </p>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-6 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
