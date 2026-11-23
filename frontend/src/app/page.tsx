import Revv3DHero from "@/components/hero3d/Revv3DHero";

import Link from "next/link";
import CarSearch, {
  type Car,
  type VehiclePhoto,
} from "@/components/CarSearch";

const API_URL = "http://127.0.0.1:8000";

type MarketplaceResult = {
  cars: Car[];
  error: boolean;
};

async function getCars(): Promise<MarketplaceResult> {
  try {
    const response = await fetch(`${API_URL}/api/v1/cars`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Vehicle API error: ${response.status}`);
    }

    const result: unknown = await response.json();

    if (
      !result ||
      typeof result !== "object" ||
      !("data" in result) ||
      !Array.isArray(result.data)
    ) {
      throw new Error("Unexpected vehicle API response");
    }

    const vehicles = result.data as Car[];

    const cars = await Promise.all(
      vehicles.map(async (car): Promise<Car> => {
        let images: VehiclePhoto[] = [];

        try {
          const imageResponse = await fetch(
            `${API_URL}/api/v1/cars/${car.id}/images`,
            { cache: "no-store" }
          );

          if (imageResponse.ok) {
            const gallery: unknown = await imageResponse.json();

            if (
              gallery &&
              typeof gallery === "object" &&
              "images" in gallery &&
              Array.isArray(gallery.images)
            ) {
              images = gallery.images as VehiclePhoto[];
            }
          }
        } catch (error) {
          console.error(
            `Vehicle ${car.id} photo loading failed:`,
            error
          );
        }

        return { ...car, images };
      })
    );

    return { cars, error: false };
  } catch (error) {
    console.error("REVV marketplace error:", error);

    return { cars: [], error: true };
  }
}

function SectionLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-400">
      {children}
    </p>
  );
}

export default async function Home() {
  const { cars, error } = await getCars();

  const locations = new Set(
    cars
      .map((car) => car.location.trim().toLowerCase())
      .filter(Boolean)
  );

  return (
    <main className="min-h-screen bg-[#080f1c] text-white">

      {/* ===================================
          HERO — SCROLL-CONTROLLED AUCKLAND 3D
      =================================== */}

      <Revv3DHero
        vehicleCount={error ? null : cars.length}
        locationCount={error ? null : locations.size}
      />

      {/* ===================================
          MARKETPLACE
      =================================== */}

      <section
        id="explore"
        className="scroll-mt-20 bg-[#f5f7fb] px-6 py-24 text-[#101827] sm:px-8"
      >
        <div className="mx-auto max-w-7xl">

          <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">
                THE REVV MARKETPLACE
              </p>

              <h2 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
                Find your next drive.
              </h2>

              <p className="mt-4 max-w-2xl text-slate-600">
                From everyday vehicles to performance
                machines, discover cars advertised across
                New Zealand.
              </p>
            </div>

            {!error && (
              <div className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600">
                {cars.length} vehicles to explore
              </div>
            )}
          </div>

          {error ? (
            <div
              role="alert"
              className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-amber-950"
            >
              <h3 className="text-xl font-bold">
                Marketplace temporarily unavailable
              </h3>
              <p className="mt-3 text-sm">
                We couldn't connect to REVV's vehicle
                service. Check the backend and refresh.
              </p>
            </div>
          ) : (
            <CarSearch cars={cars} />
          )}

          <p className="mt-10 text-xs text-slate-500">
            REVV is currently in development.
            Listings are for demonstration and testing.
            Independently verify vehicle details before purchase.
          </p>
        </div>
      </section>

      {/* ===================================
          WHY REVV
      =================================== */}

      <section className="bg-[#0b1424] px-6 py-24 sm:px-8">
        <div className="mx-auto max-w-7xl">

          <SectionLabel>THE REVV EXPERIENCE</SectionLabel>

          <h2 className="mt-5 max-w-3xl text-4xl font-black tracking-tight md:text-5xl">
            A better way to
            <span className="text-blue-400"> move forward.</span>
          </h2>

          <p className="mt-5 max-w-2xl leading-8 text-slate-400">
            We're building a connected platform that
            makes automotive buying, selling and
            vehicle management simpler.
          </p>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: "🚘",
                title: "Discover",
                description:
                  "Explore real vehicle listings, filter your options and find a car that suits your needs.",
              },
              {
                icon: "📸",
                title: "List with Ease",
                description:
                  "Create vehicle listings, upload photos and manage your advertised vehicles.",
              },
              {
                icon: "✨",
                title: "Smarter Decisions",
                description:
                  "Our upcoming AI features aim to bring clearer valuations and useful automotive insights.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 transition hover:border-blue-500/30"
              >
                <span className="text-3xl" aria-hidden="true">
                  {feature.icon}
                </span>

                <h3 className="mt-7 text-xl font-bold">
                  {feature.title}
                </h3>

                <p className="mt-4 text-sm leading-7 text-slate-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ===================================
          DEALERSHIP PLATFORM
      =================================== */}

      <section
        id="dealer-platform"
        className="bg-[#111d30] px-6 py-24 sm:px-8"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">

          <div>
            <SectionLabel>REVV FOR DEALERSHIPS</SectionLabel>

            <h2 className="mt-5 text-4xl font-black leading-tight tracking-tight md:text-5xl">
              Built for the
              <span className="block text-blue-400">
                automotive business.
              </span>
            </h2>

            <p className="mt-6 text-base leading-8 text-slate-400">
              From independent dealerships to major
              automotive groups, REVV is being designed
              to make inventory management and selling
              more efficient.
            </p>

            <p className="mt-5 text-sm leading-7 text-slate-400">
              Our longer-term vision includes dealership
              accounts, shared inventory, customer lead
              management, analytics and AI-powered tools.
            </p>

            <Link
              href="/login"
              className="mt-8 inline-flex rounded-xl border border-white/20 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Access Your Account →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: "🚗",
                title: "Inventory",
                description:
                  "Organise vehicle listings and photos.",
                status: "Prototype available",
              },
              {
                icon: "👥",
                title: "Team Management",
                description:
                  "Dealership staff and permission controls.",
                status: "Planned",
              },
              {
                icon: "💬",
                title: "Customer Enquiries",
                description:
                  "Manage buyer interest and follow-ups.",
                status: "Planned",
              },
              {
                icon: "📊",
                title: "Business Insights",
                description:
                  "Track real inventory and sales performance.",
                status: "Planned",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-[#19283f] p-6"
              >
                <span className="text-3xl" aria-hidden="true">
                  {feature.icon}
                </span>

                <h3 className="mt-5 text-lg font-bold">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {feature.description}
                </p>

                <p className="mt-5 text-xs font-medium text-blue-300">
                  {feature.status}
                </p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ===================================
          REVV AI
      =================================== */}

      <section
        id="intelligence"
        className="relative overflow-hidden bg-[#080f1c] px-6 py-24 sm:px-8"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl">

          <SectionLabel>REVV AI INTELLIGENCE</SectionLabel>

          <h2 className="mt-5 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
            More than data.
            <span className="block text-blue-400">
              Automotive intelligence.
            </span>
          </h2>

          <p className="mt-7 max-w-2xl text-base leading-8 text-slate-400">
            AI is central to REVV's future.
            We're developing intelligent tools that
            aim to make vehicle buying, selling
            and inventory decisions more informed.
          </p>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                number: "01",
                title: "AI Vehicle Valuations",
                description:
                  "Future NZ-market price estimates using vehicle details, condition and comparable listings.",
              },
              {
                number: "02",
                title: "Vehicle Condition Analysis",
                description:
                  "AI-assisted examination of visible condition indicators in uploaded photos.",
              },
              {
                number: "03",
                title: "Dealer Intelligence",
                description:
                  "Future stock insights, pricing recommendations and intelligent listing assistance.",
              },
            ].map((feature) => (
              <div
                key={feature.number}
                className="rounded-2xl border border-blue-500/15 bg-gradient-to-br from-blue-500/[0.08] to-white/[0.02] p-8"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-blue-400">
                    {feature.number}
                  </span>

                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
                    Coming later
                  </span>
                </div>

                <h3 className="mt-10 text-xl font-bold">
                  {feature.title}
                </h3>

                <p className="mt-4 text-sm leading-7 text-slate-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-xs leading-6 text-slate-500">
            These AI capabilities are planned and not
            currently available. Future estimates will
            require reliable NZ market data and transparent
            confidence ranges.
          </p>
        </div>
      </section>

      {/* ===================================
          FINAL CTA
      =================================== */}

      <section className="bg-blue-600 px-6 py-16 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-8">

          <div>
            <h2 className="text-3xl font-black tracking-tight md:text-4xl">
              Your next drive starts here.
            </h2>

            <p className="mt-3 text-sm text-blue-100">
              Discover vehicles or start selling with REVV.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="#explore"
              className="rounded-xl bg-white px-6 py-3.5 font-bold text-blue-700 transition hover:bg-blue-50"
            >
              Explore Cars
            </a>

            <Link
              href="/sell"
              className="rounded-xl border border-white/50 px-6 py-3.5 font-bold text-white transition hover:bg-white/10"
            >
              Sell Your Vehicle
            </Link>
          </div>
        </div>
      </section>

    </main>
  );
}
