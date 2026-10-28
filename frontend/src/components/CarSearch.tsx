
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type Car = {
  id: number;
  make: string;
  model: string;
  year: number;
  price_nzd: number;
  mileage_km: number;
  location: string;
};

export default function CarSearch({ cars }: { cars: Car[] }) {
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [location, setLocation] = useState("all");

  const locations = [...new Set(cars.map((car) => car.location))];

  const filteredCars = useMemo(() => {
    return cars.filter((car) => {
      const matchesSearch =
        `${car.make} ${car.model} ${car.year}`
          .toLowerCase()
          .includes(search.trim().toLowerCase());

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
  }, [cars, search, minPrice, maxPrice, location]);

  function resetFilters() {
    setSearch("");
    setMinPrice("");
    setMaxPrice("");
    setLocation("all");
  }

  return (
    <div className="space-y-8">
      {/* Search and filter controls */}
      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-4">
        <div>
          <label
            htmlFor="car-search"
            className="mb-2 block text-sm font-medium"
          >
            Search vehicles
          </label>

          <input
            id="car-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="BMW, Audi, 2024..."
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="min-price"
            className="mb-2 block text-sm font-medium"
          >
            Min price (NZD)
          </label>

          <input
            id="min-price"
            type="number"
            min="0"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Any"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="max-price"
            className="mb-2 block text-sm font-medium"
          >
            Max price (NZD)
          </label>

          <input
            id="max-price"
            type="number"
            min="0"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Any"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="location"
            className="mb-2 block text-sm font-medium"
          >
            Location
          </label>

          <select
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-3 text-zinc-900 outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Search results */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-600">
          {filteredCars.length} vehicles found
        </p>

        <button
          type="button"
          onClick={resetFilters}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100"
        >
          Reset filters
        </button>
      </div>

      {/* Vehicle cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredCars.map((car) => (
          <article
            key={car.id}
            className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:shadow-lg"
          >
            <div className="flex h-48 items-center justify-center bg-zinc-100 text-sm text-zinc-500">
              Vehicle photo coming soon
            </div>

            <div className="p-5">
              <h3 className="text-xl font-bold text-zinc-900">
                {car.year} {car.make} {car.model}
              </h3>

              <p className="mt-3 text-2xl font-bold text-blue-600">
                NZ${car.price_nzd.toLocaleString("en-NZ")}
              </p>

              <div className="mt-4 flex justify-between gap-2 text-sm text-zinc-500">
                <span>
                  {car.mileage_km.toLocaleString("en-NZ")} km
                </span>
                <span>{car.location}</span>
              </div>

              <Link
                href={`/cars/${car.id}`}
                className="mt-5 block rounded-lg bg-zinc-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-600"
              >
                View Vehicle
              </Link>
            </div>
          </article>
        ))}
      </div>

      {filteredCars.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white py-12 text-center">
          <h3 className="text-lg font-semibold text-zinc-900">
            No vehicles found
          </h3>

          <p className="mt-2 text-sm text-zinc-500">
            Try changing your search or filters.
          </p>

          <button
            onClick={resetFilters}
            className="mt-5 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
