
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Car } from "@/components/CarSearch";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function getCar(id: string): Promise<Car | null> {
  const response = await fetch(
    `http://127.0.0.1:8000/api/v1/cars/${id}`,
    { cache: "no-store" }
  );

  if (response.status === 404 || response.status === 422) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to retrieve vehicle");
  }

  return response.json();
}

export default async function CarDetailsPage({
  params,
}: PageProps) {
  const { id } = await params;

  if (!/^\d+$/.test(id)) {
    notFound();
  }

  const car = await getCar(id);

  if (!car) {
    notFound();
  }

  const formattedPrice = new Intl.NumberFormat("en-NZ", {
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
            {car.year} {car.make} {car.model}
          </h1>

          <p className="mt-3 text-zinc-500">
            {car.location}, New Zealand
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {/* Vehicle gallery */}
            <div className="flex aspect-video items-center justify-center rounded-2xl bg-zinc-200 text-zinc-500">
              <div className="text-center">
                <p className="text-xl font-semibold">
                  Vehicle Gallery
                </p>

                <p className="mt-2 text-sm">
                  Vehicle images coming soon
                </p>
              </div>
            </div>

            {/* Specifications */}
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

            {/* REVV Intelligence */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-7">
              <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600">
                REVV Intelligence
              </p>

              <h2 className="text-2xl font-bold">
                Vehicle Price Insights
              </h2>

              <p className="mt-4 text-zinc-600">
                Price history, market comparisons and
                AI-assisted valuations are planned
                for a future release.
              </p>

              <div className="mt-6 rounded-xl bg-zinc-100 p-5">
                <p className="text-sm font-medium text-zinc-500">
                  Intelligence features
                </p>

                <p className="mt-2 font-semibold">
                  Coming Soon
                </p>
              </div>
            </section>
          </div>

          {/* Price panel */}
          <aside>
            <div className="sticky top-6 rounded-2xl border border-zinc-200 bg-white p-7 shadow-sm">
              <p className="text-sm font-medium text-zinc-500">
                Asking Price
              </p>

              <p className="mt-2 text-4xl font-bold text-blue-600">
                {formattedPrice}
              </p>

              <div className="mt-7 space-y-4 border-t border-zinc-200 pt-6">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Year</span>
                  <span className="font-semibold">{car.year}</span>
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
                This is a fictional demonstration listing.
                Seller enquiries are not available yet.
              </div>

              <button
                disabled
                className="mt-5 w-full cursor-not-allowed rounded-lg bg-zinc-300 px-5 py-4 font-semibold text-zinc-600"
              >
                Contact Seller — Coming Soon
              </button>

              <Link
                href="/#explore"
                className="mt-3 block w-full rounded-lg border border-zinc-300 px-5 py-4 text-center font-semibold hover:bg-zinc-50"
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
