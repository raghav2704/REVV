
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

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

function getPhotoUrl(photo: VehiclePhoto) {
  return `${API_URL}${photo.url}`;
}

export function VehicleGallery({
  images,
  title,
}: {
  images: VehiclePhoto[];
  title: string;
}) {
  const sortedImages = [...images].sort(
    (a, b) => a.position - b.position
  );

  const coverIndex = Math.max(
    0,
    sortedImages.findIndex((image) => image.is_cover)
  );

  const [activeIndex, setActiveIndex] = useState(coverIndex);

  if (sortedImages.length === 0) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl bg-zinc-200 text-zinc-500">
        Vehicle images coming soon
      </div>
    );
  }

  const active = sortedImages[activeIndex] ?? sortedImages[0];

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl bg-zinc-100">
        {/* Using native img for images hosted by local FastAPI */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={getPhotoUrl(active)}
          alt={`${title} - photo ${activeIndex + 1}`}
          className="aspect-video w-full object-contain"
        />

        <div className="absolute bottom-4 right-4 rounded-full bg-black/70 px-4 py-2 text-sm text-white">
          {activeIndex + 1} / {sortedImages.length}
        </div>
      </div>

      {sortedImages.length > 1 && (
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
          {sortedImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`View photo ${index + 1}`}
              aria-pressed={activeIndex === index}
              className={`overflow-hidden rounded-xl border-2 ${
                activeIndex === index
                  ? "border-blue-600"
                  : "border-transparent"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getPhotoUrl(image)}
                alt={`${title} thumbnail ${index + 1}`}
                className="aspect-square w-full bg-zinc-100 object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CarSearch({
  cars,
}: {
  cars: Car[];
}) {
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState("newest");

  const locations = [
    ...new Set(cars.map((car) => car.location)),
  ].sort();

  const filteredCars = useMemo(() => {
    const results = cars.filter((car) => {
      const query =
        `${car.make} ${car.model} ${car.year}`.toLowerCase();

      return (
        query.includes(search.trim().toLowerCase()) &&
        (minPrice === "" ||
          car.price_nzd >= Number(minPrice)) &&
        (maxPrice === "" ||
          car.price_nzd <= Number(maxPrice)) &&
        (location === "all" || car.location === location)
      );
    });

    return [...results].sort((a, b) => {
      if (sort === "price-low") {
        return a.price_nzd - b.price_nzd;
      }

      if (sort === "price-high") {
        return b.price_nzd - a.price_nzd;
      }

      if (sort === "mileage") {
        return a.mileage_km - b.mileage_km;
      }

      return b.year - a.year;
    });
  }, [cars, search, minPrice, maxPrice, location, sort]);

  function resetFilters() {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setLocation("all");
    setSort("newest");
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="space-y-8">
      {/* FILTERS */}
      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm md:grid-cols-4">
        <div>
          <label htmlFor="search" className="mb-2 block text-sm font-medium">
            Search vehicles
          </label>
          <input
            id="search"
            type="search"
            placeholder="BMW, Lexus, 2024..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="min-price" className="mb-2 block text-sm font-medium">
            Min price (NZD)
          </label>
          <input
            id="min-price"
            type="number"
            min="0"
            placeholder="Any"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="max-price" className="mb-2 block text-sm font-medium">
            Max price (NZD)
          </label>
          <input
            id="max-price"
            type="number"
            min="0"
            placeholder="Any"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="location" className="mb-2 block text-sm font-medium">
            Location
          </label>
          <select
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClass}
          >
            <option value="all">All locations</option>
            {locations.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* RESULTS */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-zinc-600">
          {filteredCars.length} vehicles found
        </p>

        <div className="flex gap-3">
          <select
            aria-label="Sort vehicles"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="newest">Newest first</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
            <option value="mileage">Lowest mileage</option>
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
          >
            Reset filters
          </button>
        </div>
      </div>

      {/* VEHICLES */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredCars.map((car) => {
          const cover =
            car.images?.find((image) => image.is_cover) ??
            car.images?.[0];

          return (
            <article
              key={car.id}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
            >
              <Link href={`/cars/${car.id}`}>
                <div className="relative h-56 overflow-hidden bg-zinc-100">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getPhotoUrl(cover)}
                      alt={`${car.year} ${car.make} ${car.model}`}
                      className="h-full w-full object-cover transition duration-300 hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                      Vehicle photo coming soon
                    </div>
                  )}

                  <span className="absolute bottom-3 left-3 rounded-lg bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                    {car.location}
                  </span>
                </div>
              </Link>

              <div className="p-6">
                <h3 className="text-xl font-bold text-zinc-900">
                  {car.year} {car.make} {car.model}
                </h3>

                <p className="mt-3 text-2xl font-bold text-blue-600">
                  NZ${car.price_nzd.toLocaleString("en-NZ")}
                </p>

                <p className="mt-3 text-sm text-zinc-500">
                  {car.mileage_km.toLocaleString("en-NZ")} km
                </p>

                <Link
                  href={`/cars/${car.id}`}
                  className="mt-6 block rounded-lg bg-zinc-950 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-600"
                >
                  View Vehicle
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {filteredCars.length === 0 && (
        <div className="rounded-2xl bg-white p-12 text-center">
          <p className="font-semibold">No vehicles found</p>
          <p className="mt-2 text-sm text-zinc-500">
            Try adjusting your search filters.
          </p>
        </div>
      )}
    </div>
  );
}
