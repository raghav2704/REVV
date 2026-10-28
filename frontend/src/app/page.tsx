
import CarSearch, { type Car } from "@/components/CarSearch";

// Fetch vehicles from FastAPI and PostgreSQL
async function getCars(): Promise<Car[]> {
  const response = await fetch(
    "http://127.0.0.1:8000/api/v1/cars",
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to load vehicles");
  }

  const result: { data: Car[] } = await response.json();

  return result.data;
}

export default async function Home() {
  const cars = await getCars();

  return (
    <main className="min-h-screen bg-[#080d16] text-white">
      {/* CINEMATIC REVV HERO */}
      <section
        className="relative flex min-h-[440px] items-center overflow-hidden bg-cover bg-center md:min-h-[540px]"
        style={{
          backgroundImage: "url('/revv-background.png')",
        }}
      >
        {/* Dark gradient to make text readable */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#07101f]/85 via-[#07101f]/35 to-transparent" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">
            THE NEW WAY TO DRIVE
          </p>

          <h1 className="text-6xl font-black tracking-[-0.07em] text-white md:text-8xl">
            REV<span className="text-blue-500">V</span>
          </h1>

          <p className="mt-4 text-base font-medium tracking-[0.25em] text-white md:text-lg">
            BUY. SELL. COMPARE CARS.
          </p>

          <p className="mt-6 max-w-md text-sm leading-7 text-zinc-200 md:text-base">
            Discover vehicles, explore market insights
            and make smarter buying decisions across
            New Zealand.
          </p>

          <a
            href="#explore"
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-blue-600 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Explore Cars
            <span className="ml-3" aria-hidden="true">
              →
            </span>
          </a>
        </div>
      </section>

      {/* VEHICLE MARKETPLACE */}
      <section
        id="explore"
        className="bg-[#f5f6f8] px-6 py-20 text-zinc-900"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-10">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
              THE REVV MARKETPLACE
            </p>

            <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
              Find your next drive.
            </h2>

            <p className="mt-4 max-w-2xl text-zinc-500">
              Discover and compare vehicles across
              New Zealand. Find the right car for
              your next journey.
            </p>
          </div>

          {/* Working search filters and vehicle listings */}
          <CarSearch cars={cars} />

          <p className="mt-10 text-xs text-zinc-500">
            REVV is currently in development.
            Listings are for demonstration and
            testing purposes only.
          </p>
        </div>
      </section>

      {/* REVV INTELLIGENCE */}
      <section
        id="intelligence"
        className="relative overflow-hidden bg-[#0d1420] px-6 py-24 text-white"
      >
        <div className="pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-blue-400">
            REVV INTELLIGENCE
          </p>

          <h2 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Intelligence behind
            <span className="text-blue-400">
              {" "}every drive.
            </span>
          </h2>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            REVV is developing smarter automotive tools
            that combine vehicle discovery, market
            insights, price tracking and AI-assisted
            valuations.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                number: "01",
                title: "Vehicle Marketplace",
                description:
                  "Browse, search and explore vehicles across New Zealand.",
              },
              {
                number: "02",
                title: "Price Intelligence",
                description:
                  "Understand vehicle pricing and market trends with future data-driven insights.",
              },
              {
                number: "03",
                title: "AI Valuations",
                description:
                  "Planned AI-assisted price estimates to support smarter buying and selling decisions.",
              },
            ].map((feature) => (
              <div
                key={feature.number}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 transition hover:border-blue-500/40 hover:bg-white/[0.06]"
              >
                <span className="text-sm font-bold text-blue-400">
                  {feature.number}
                </span>

                <h3 className="mt-6 text-xl font-semibold">
                  {feature.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <a
              href="#explore"
              className="inline-flex items-center gap-3 text-sm font-semibold text-blue-400 transition hover:text-blue-300"
            >
              Explore the marketplace
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
