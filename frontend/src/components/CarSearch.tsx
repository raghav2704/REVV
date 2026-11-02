
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const API_URL = "http://127.0.0.1:8000";

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
  images?: VehiclePhoto[];
};

type SortOption =
  | "newest"
  | "price-low"
  | "price-high"
  | "mileage-low"
  | "year-old";

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-NZ").format(value);
}

function getPhotoUrl(photo: VehiclePhoto) {
  return new URL(photo.url, API_URL).toString();
}

/* =====================================================
   VEHICLE GALLERY
   Retained for public vehicle detail pages
===================================================== */

export function VehicleGallery({
  images,
  title,
}: {
  images: VehiclePhoto[];
  title: string;
}) {
  const sortedImages = useMemo(
    () =>
      [...images].sort(
        (a, b) =>
          a.position - b.position || a.id - b.id
      ),
    [images]
  );

  const coverIndex = Math.max(
    0,
    sortedImages.findIndex((photo) => photo.is_cover)
  );

  const [activeIndex, setActiveIndex] = useState(coverIndex);

  const safeIndex =
    activeIndex >= 0 && activeIndex < sortedImages.length
      ? activeIndex
      : coverIndex;

  if (sortedImages.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        Vehicle photos coming soon
      </div>
    );
  }

  const active = sortedImages[safeIndex];

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getPhotoUrl(active)}
          alt={`${title} - photo ${safeIndex + 1}`}
          className="aspect-video w-full object-contain"
        />

        <span className="absolute bottom-4 right-4 rounded-full bg-black/75 px-4 py-2 text-xs font-semibold text-white">
          {safeIndex + 1} / {sortedImages.length}
        </span>
      </div>

      {sortedImages.length > 1 && (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {sortedImages.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`View photo ${index + 1}`}
              aria-pressed={safeIndex === index}
              className={`overflow-hidden rounded-xl border-2 transition ${
                safeIndex === index
                  ? "border-blue-600"
                  : "border-transparent hover:border-blue-300"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPhotoUrl(photo)}
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

/* =====================================================
   VEHICLE CARD
===================================================== */

function VehicleCard({ car }: { car: Car }) {
  const sorted = [...(car.images ?? [])].sort(
    (a, b) => a.position - b.position || a.id - b.id
  );

  const cover =
    sorted.find((photo) => photo.is_cover) ?? sorted[0];

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-blue-300 hover:shadow-[0_18px_45px_rgba(15,23,42,0.14)] motion-reduce:transform-none">
      <Link
        href={`/cars/${car.id}`}
        aria-label={`View ${car.year} ${car.make} ${car.model}`}
        className="relative block h-56 overflow-hidden bg-slate-100"
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getPhotoUrl(cover)}
            alt={`${car.year} ${car.make} ${car.model}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transform-none"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
            <span aria-hidden="true" className="text-4xl">
              🚘
            </span>
            <span className="text-sm">Photos coming soon</span>
          </div>
        )}

        <span className="absolute bottom-3 left-3 rounded-lg bg-black/75 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
          {car.location}
        </span>

        {sorted.length > 0 && (
          <span className="absolute bottom-3 right-3 rounded-lg bg-black/75 px-3 py-1.5 text-xs text-white">
            📷 {sorted.length}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-6">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-600">
            REVV VEHICLE
          </p>

          <h3 className="mt-2 text-xl font-bold tracking-tight text-[#111827]">
            {car.year} {car.make} {car.model}
          </h3>

          <p className="mt-3 text-2xl font-black text-blue-600">
            {formatPrice(car.price_nzd)}
          </p>

          <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-sm text-slate-500">
            <span aria-hidden="true">◉</span>
            <span>{formatNumber(car.mileage_km)} km</span>
            <span className="mx-2 text-slate-300">•</span>
            <span className="truncate">{car.location}</span>
          </div>
        </div>

        <Link
          href={`/cars/${car.id}`}
          className="mt-6 block rounded-xl bg-[#111c2e] px-5 py-3.5 text-center text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          View Vehicle →
        </Link>
      </div>
    </article>
  );
}

/* =====================================================
   MARKETPLACE SEARCH
===================================================== */

export default function CarSearch({
  cars,
}: {
  cars: Car[];
}) {
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState<SortOption>("newest");

  const locations = useMemo(
    () =>
      [...new Set(cars.map((car) => car.location))]
        .filter(Boolean)
        .sort(),
    [cars]
  );

  const filteredCars = useMemo(() => {
    const query = search.trim().toLowerCase();

    const results = cars.filter((car) => {
      const searchable = [
        car.make,
        car.model,
        String(car.year),
        car.location,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchable.includes(query);

      const matchesMin =
        minPrice === "" ||
        car.price_nzd >= Number(minPrice);

      const matchesMax =
        maxPrice === "" ||
        car.price_nzd <= Number(maxPrice);

      const matchesLocation =
        location === "all" || car.location === location;

      return (
        matchesSearch &&
        matchesMin &&
        matchesMax &&
        matchesLocation
      );
    });

    return [...results].sort((a, b) => {
      switch (sort) {
        case "price-low":
          return a.price_nzd - b.price_nzd;

        case "price-high":
          return b.price_nzd - a.price_nzd;

        case "mileage-low":
          return a.mileage_km - b.mileage_km;

        case "year-old":
          return a.year - b.year || a.id - b.id;

        default:
          return b.year - a.year || b.id - a.id;
      }
    });
  }, [cars, search, minPrice, maxPrice, location, sort]);

  const activeFilters =
    search.trim() !== "" ||
    minPrice !== "" ||
    maxPrice !== "" ||
    location !== "all" ||
    sort !== "newest";

  function resetFilters() {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setLocation("all");
    setSort("newest");
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10";

  return (
    <div className="space-y-8">

      {/* SEARCH PANEL */}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Find your perfect car
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Search and filter vehicles listed on REVV.
            </p>
          </div>

          {activeFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Clear all filters
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm font-medium text-slate-700">
            Search vehicles
            <input
              type="search"
              placeholder="BMW, Audi, 2024..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              className={`mt-2 ${inputClass}`}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Minimum price
            <input
              type="number"
              min={0}
              step={1000}
              placeholder="No minimum"
              value={minPrice}
              onChange={(event) =>
                setMinPrice(event.target.value)
              }
              className={`mt-2 ${inputClass}`}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Maximum price
            <input
              type="number"
              min={0}
              step={1000}
              placeholder="No maximum"
              value={maxPrice}
              onChange={(event) =>
                setMaxPrice(event.target.value)
              }
              className={`mt-2 ${inputClass}`}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Location
            <select
              value={location}
              onChange={(event) =>
                setLocation(event.target.value)
              }
              className={`mt-2 ${inputClass}`}
            >
              <option value="all">All New Zealand</option>

              {locations.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* RESULTS BAR */}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-slate-900">
            {filteredCars.length}{" "}
            {filteredCars.length === 1
              ? "vehicle found"
              : "vehicles found"}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Browse available REVV listings
          </p>
        </div>

        <label className="flex items-center gap-3 text-sm text-slate-600">
          Sort by

          <select
            value={sort}
            onChange={(event) =>
              setSort(event.target.value as SortOption)
            }
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-500"
          >
            <option value="newest">Newest first</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="mileage-low">Lowest Mileage</option>
            <option value="year-old">Oldest Vehicle</option>
          </select>
        </label>
      </div>

      {/* VEHICLES */}

      {filteredCars.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <div className="text-5xl" aria-hidden="true">
            🚗
          </div>

          <h3 className="mt-5 text-2xl font-bold text-slate-900">
            No matching vehicles
          </h3>

          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-500">
            We couldn't find any vehicles matching your
            search. Try changing the price range, location
            or search term.
          </p>

          {activeFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-6 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCars.map((car) => (
            <VehicleCard key={car.id} car={car} />
          ))}
        </div>
      )}
    </div>
  );
}
