
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  VehicleGallery,
  type Car,
  type VehiclePhoto,
} from "@/components/CarSearch";

const API_URL = "http://127.0.0.1:8000";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function getVehicle(id: string): Promise<{
  car: Car;
  images: VehiclePhoto[];
} | null> {
  const carResponse = await fetch(
    `${API_URL}/api/v1/cars/${id}`,
    { cache: "no-store" }
  );

  if (carResponse.status === 404) {
    return null;
  }

  if (!carResponse.ok) {
    throw new Error("Failed to load vehicle");
  }

  const car: Car = await carResponse.json();

  const imageResponse = await fetch(
    `${API_URL}/api/v1/cars/${id}/images`,
    { cache: "no-store" }
  );

  if (!imageResponse.ok) {
    throw new Error("Failed to load vehicle photos");
  }

  const imageData: { images: VehiclePhoto[] } =
    await imageResponse.json();

  return {
    car,
    images: imageData.images,
  };
}

export default async function CarDetailsPage({
  params,
}: PageProps) {
  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    notFound();
  }

  const result = await getVehicle(id);

  if (!result) {
    notFound();
  }

  const { car, images } = result;

  const title =
    `${car.year} ${car.make} ${car.model}`;

  const price = new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(car.price_nzd);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link
          href="/#explore"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back to vehicles
        </Link>

        <div className="mt-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600">
            Vehicle Details
          </p>

          <h1 className="text-4xl font-bold">
            {title}
          </h1>

          <p className="mt-3 text-zinc-500">
            {car.location}, New Zealand
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {/* INTERACTIVE GALLERY */}
            <VehicleGallery
              images={images}
              title={title}
            />

            {/* VEHICLE SPECIFICATIONS */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-7">
              <h2 className="mb-6 text-2xl font-bold">
                Vehicle Specifications
              </h2>

              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                {[
                  ["Make", car.make],
                  ["Model", car.model],
                  ["Year", car.year],
                  [
                    "Mileage",
                    `${car.mileage_km.toLocaleString("en-NZ")} km`,
                  ],
                  ["Location", car.location],
                  ["Currency", "NZD"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-sm text-zinc-500">
                      {label}
                    </p>
                    <p className="mt-2 font-semibold">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* INTELLIGENCE */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-7">
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600">
                REVV Intelligence
              </p>

              <h2 className="text-2xl font-bold">
                Vehicle Price Insights
              </h2>

              <p className="mt-4 text-zinc-600">
                Market comparisons, price history and
                AI-assisted valuations are planned
                for future REVV releases.
              </p>
            </section>
          </div>

          {/* PRICE PANEL */}
          <aside>
            <div className="sticky top-6 rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
              <p className="text-sm text-zinc-500">
                Asking Price
              </p>

              <p className="mt-2 text-4xl font-bold text-blue-600">
                {price}
              </p>

              <div className="mt-7 space-y-4 border-t border-zinc-200 pt-6">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Year</span>
                  <span className="font-semibold">
                    {car.year}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-zinc-500">Mileage</span>
                  <span className="font-semibold">
                    {car.mileage_km.toLocaleString("en-NZ")} km
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-zinc-500">Location</span>
                  <span className="font-semibold">
                    {car.location}
                  </span>
                </div>
              </div>

              <div className="mt-8 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                This is a demonstration listing.
                Seller enquiries are not yet available.
              </div>

              <button
                disabled
                className="mt-5 w-full cursor-not-allowed rounded-lg bg-zinc-300 px-5 py-4 font-semibold text-zinc-600"
              >
                Contact Seller — Coming Soon
              </button>

              <Link
                href="/#explore"
                className="mt-3 block rounded-lg border border-zinc-300 px-5 py-4 text-center font-semibold hover:bg-zinc-50"
              >
                Browse More Cars
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
