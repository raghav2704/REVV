
import Link from "next/link";
import { notFound } from "next/navigation";
import ContactSellerButton from "@/components/ContactSellerButton";

import {
  VehicleGallery,
  type Car,
  type VehiclePhoto,
} from "@/components/CarSearch";

const API_URL = "http://127.0.0.1:8000";

type PageProps = {
  params: Promise<{ id: string }>;
};

type DetailedCar = Car & {
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
  wof_expiry?: string | null;
  registration_expiry?: string | null;
};

type Specification = {
  label: string;
  value: string | number;
};

function isPresent(
  value: string | number | null | undefined
): value is string | number {
  return (
    value !== null &&
    value !== undefined &&
    String(value).trim().length > 0
  );
}

function formatDate(
  value: string | null | undefined
): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return new Intl.DateTimeFormat("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

async function getVehicle(
  id: string
): Promise<{
  car: DetailedCar;
  images: VehiclePhoto[];
} | null> {
  const carResponse = await fetch(
    `${API_URL}/api/v1/cars/${id}`,
    {
      cache: "no-store",
    }
  );

  if (carResponse.status === 404) {
    return null;
  }

  if (!carResponse.ok) {
    throw new Error("Failed to load vehicle");
  }

  const car: DetailedCar = await carResponse.json();

  const imageResponse = await fetch(
    `${API_URL}/api/v1/cars/${id}/images`,
    {
      cache: "no-store",
    }
  );

  if (!imageResponse.ok) {
    throw new Error("Failed to load vehicle photos");
  }

  const imageData: {
    images: VehiclePhoto[];
  } = await imageResponse.json();

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

  const title = `${car.year} ${car.make} ${car.model}`;

  const price = new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(car.price_nzd);

  const specifications: Specification[] = [
    {
      label: "Make",
      value: car.make,
    },
    {
      label: "Model",
      value: car.model,
    },
    {
      label: "Year",
      value: car.year,
    },
    {
      label: "Mileage",
      value: `${car.mileage_km.toLocaleString("en-NZ")} km`,
    },
    {
      label: "Location",
      value: car.location,
    },
    {
      label: "Variant / Trim",
      value: car.variant ?? "",
    },
    {
      label: "Body Type",
      value: car.body_type ?? "",
    },
    {
      label: "Exterior Colour",
      value: car.exterior_colour ?? "",
    },
    {
      label: "Seats",
      value: car.seats ?? "",
    },
    {
      label: "Fuel Type",
      value: car.fuel_type ?? "",
    },
    {
      label: "Transmission",
      value: car.transmission ?? "",
    },
    {
      label: "Drivetrain",
      value: car.drivetrain ?? "",
    },
    {
      label: "Engine",
      value: car.engine_cc
        ? `${car.engine_cc.toLocaleString("en-NZ")} cc`
        : "",
    },
    {
      label: "Condition",
      value: car.condition ?? "",
    },
    {
      label: "Vehicle Origin",
      value: car.vehicle_origin ?? "",
    },
    {
      label: "WOF Expiry",
      value: formatDate(car.wof_expiry) ?? "",
    },
    {
      label: "Registration Expiry",
      value: formatDate(car.registration_expiry) ?? "",
    },
  ].filter((item) => isPresent(item.value));

  const summary = [
    {
      label: "Year",
      value: String(car.year),
    },
    {
      label: "Mileage",
      value: `${car.mileage_km.toLocaleString("en-NZ")} km`,
    },
    {
      label: "Location",
      value: car.location,
    },
    {
      label: "Fuel",
      value: car.fuel_type,
    },
    {
      label: "Transmission",
      value: car.transmission,
    },
  ].filter((item) => isPresent(item.value));

  return (
    <main className="min-h-screen bg-[#080f1c] text-white">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
        {/* BACK NAVIGATION */}

        <Link
          href="/#explore"
          className="text-sm font-semibold text-blue-300 transition hover:text-white"
        >
          ← Back to vehicles
        </Link>

        {/* VEHICLE HEADING */}

        <header className="mt-8">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.22em] text-blue-400">
            REVV / VEHICLE DETAILS
          </p>

          <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            {title}
          </h1>

          {car.variant && (
            <p className="mt-3 text-lg font-semibold text-blue-300">
              {car.variant}
            </p>
          )}

          <p className="mt-3 text-sm text-slate-400">
            {car.location}, New Zealand
          </p>
        </header>

        {/* MAIN LAYOUT */}

        <div className="mt-9 grid items-start gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            {/* VEHICLE PHOTO GALLERY */}

            <VehicleGallery
              images={images}
              title={title}
            />

            {/* VEHICLE SPECIFICATIONS */}

            <section className="rounded-3xl border border-white/10 bg-[#0E1A2C] p-6 shadow-xl sm:p-8">
              <div className="mb-7">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">
                  VEHICLE PROFILE
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Vehicle Specifications
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Details provided for this vehicle.
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3">
                {specifications.map(({ label, value }) => (
                  <div
                    key={label}
                    className="min-w-0 border-t border-white/10 pt-4"
                  >
                    <dt className="text-xs font-medium text-slate-400">
                      {label}
                    </dt>

                    <dd className="mt-2 break-words text-sm font-bold text-white sm:text-base">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* SELLER DESCRIPTION */}

            {car.description?.trim() && (
              <section className="rounded-3xl border border-white/10 bg-[#0E1A2C] p-6 shadow-xl sm:p-8">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">
                  MORE ABOUT THIS VEHICLE
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Seller Description
                </h2>

                <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-slate-300 sm:text-base">
                  {car.description}
                </p>
              </section>
            )}

            {/* REVV INTELLIGENCE */}

            <section className="rounded-3xl border border-white/10 bg-[#0E1A2C] p-6 shadow-xl sm:p-8">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-400">
                REVV INTELLIGENCE
              </p>

              <h2 className="text-2xl font-black tracking-tight">
                Vehicle Price Insights
              </h2>

              <p className="mt-4 text-sm leading-7 text-slate-300">
                Market comparisons, price history and
                AI-assisted valuations are planned for
                future REVV releases.
              </p>
            </section>
          </div>

          {/* RIGHT SIDEBAR */}

          <aside className="lg:sticky lg:top-6">
            <div className="rounded-3xl border border-white/10 bg-[#0E1A2C] p-6 shadow-xl sm:p-7">
              {/* ASKING PRICE */}

              <p className="text-sm font-medium text-slate-400">
                Asking Price
              </p>

              <p className="mt-2 break-words text-4xl font-black tracking-tight text-blue-300">
                {price}
              </p>

              {/* VEHICLE SUMMARY */}

              <dl className="mt-7 space-y-4 border-t border-white/10 pt-6">
                {summary.map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex justify-between gap-4 text-sm"
                  >
                    <dt className="text-slate-400">
                      {label}
                    </dt>

                    <dd className="text-right font-semibold text-white">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* CONTACT SELLER — WORKING COMPONENT */}

              <div className="mt-8 border-t border-white/10 pt-6">
                <ContactSellerButton vehicleId={car.id} />
              </div>

              {/* BROWSE MORE CARS */}

              <Link
                href="/#explore"
                className="mt-5 block rounded-xl border border-white/15 px-5 py-4 text-center font-bold transition hover:bg-white/5"
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
