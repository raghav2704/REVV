
import CarSearch, {
  type Car,
  type VehiclePhoto,
} from "@/components/CarSearch";

const API_URL = "http://127.0.0.1:8000";

async function getCars(): Promise<Car[]> {
  const response = await fetch(
    `${API_URL}/api/v1/cars`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Failed to load vehicles");
  }

  const result: { data: Car[] } = await response.json();

  const carsWithImages = await Promise.all(
    result.data.map(async (car) => {
      const imageResponse = await fetch(
        `${API_URL}/api/v1/cars/${car.id}/images`,
        { cache: "no-store" }
      );

      let images: VehiclePhoto[] = [];

      if (imageResponse.ok) {
        const imageData: { images: VehiclePhoto[] } =
          await imageResponse.json();

        images = imageData.images;
      }

      return { ...car, images };
    })
  );

  return carsWithImages;
}

export default async function Home() {
  const cars = await getCars();

  return (
    <main className="min-h-screen bg-[#080d16] text-white">
      {/* REVV HERO */}
      <section
        className="relative flex min-h-[440px] items-center overflow-hidden bg-cover bg-center md:min-h-[540px]"
        style={{
          backgroundImage: "url('/revv-background.png')",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#07101f]/85 via-[#07101f]/35 to-transparent" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">
            THE NEW WAY TO DRIVE
          </p>

          <h1 className="text-6xl font-black tracking-[-0.07em] md:text-8xl">
            REV<span className="text-blue-500">V</span>
          </h1>

          <p className="mt-4 text-base font-medium tracking-[0.25em] md:text-lg">
            BUY. SELL. COMPARE CARS.
          </p>

          <p className="mt-6 max-w-md text-sm leading-7 text-zinc-200 md:text-base">
            Discover vehicles, explore market insights
            and make smarter buying decisions across
            New Zealand.
          </p>

          <a
            href="#explore"
            className="mt-8 inline-flex rounded-lg bg-blue-600 px-7 py-3.5 text-sm font-semibold transition hover:bg-blue-500"
          >
            Explore Cars →
          </a>
        </div>
      </section>

      {/* MARKETPLACE */}
      <section
        id="explore"
        className="bg-[#f5f6f8] px-6 py-20 text-zinc-900"
      >
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
            THE REVV MARKETPLACE
          </p>

          <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
            Find your next drive.
          </h2>

          <p className="mb-10 mt-4 text-zinc-500">
            Explore and compare vehicles across New Zealand.
          </p>

          <CarSearch cars={cars} />

          <p className="mt-10 text-xs text-zinc-500">
            REVV is currently in development.
            Listings are for demonstration and testing only.
          </p>
        </div>
      </section>

      {/* INTELLIGENCE */}
      <section
        id="intelligence"
        className="bg-[#0d1420] px-6 py-24"
      >
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-blue-400">
            REVV INTELLIGENCE
          </p>

          <h2 className="max-w-3xl text-4xl font-bold md:text-6xl">
            Intelligence behind
            <span className="text-blue-400">
              {" "}every drive.
            </span>
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            We're developing market insights, vehicle
            price tracking and AI-assisted valuations
            to help New Zealand drivers make more
            informed decisions.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              ["01", "Vehicle Marketplace",
                "Discover and explore vehicles."],
              ["02", "Price Intelligence",
                "Understand vehicle market pricing."],
              ["03", "AI Valuations",
                "Future condition-aware valuation estimates."],
            ].map(([number, title, description]) => (
              <div
                key={number}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-8"
              >
                <span className="text-sm font-bold text-blue-400">
                  {number}
                </span>

                <h3 className="mt-5 text-xl font-semibold">
                  {title}
                </h3>

                <p className="mt-3 text-sm text-zinc-400">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
