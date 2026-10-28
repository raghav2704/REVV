
import CarSearch, { type Car } from "@/components/CarSearch";
import Link from "next/link";

async function getCars(): Promise<Car[]> {
  const response = await fetch(
    "http://127.0.0.1:8000/api/v1/cars",
    { cache: "no-store" }
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
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Navigation */}
      <header className="bg-zinc-950 px-6 py-5 text-white">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/"
            className="text-3xl font-black tracking-tight"
          >
            REVV<span className="text-blue-500">.</span>
          </Link>

          <div className="flex items-center gap-6 text-sm font-medium">
            <a href="#explore" className="hover:text-blue-400">
              Explore Cars
            </a>

            <span className="hidden text-zinc-500 sm:inline">
              Sell Your Car — Coming Soon
            </span>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="bg-zinc-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-sm font-semibold tracking-widest text-blue-400">
            AUTOMOTIVE MARKETPLACE & INTELLIGENCE
          </p>

          <h1 className="max-w-3xl text-5xl font-bold leading-tight md:text-6xl">
            Find your next drive.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            Discover vehicles, compare prices and make
            smarter buying decisions with REVV.
          </p>

          <a
            href="#explore"
            className="mt-8 inline-block rounded-lg bg-blue-600 px-7 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Explore Cars
          </a>
        </div>
      </section>

      {/* Marketplace */}
      <section
        id="explore"
        className="mx-auto max-w-6xl px-6 py-14"
      >
        <div className="mb-8">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-blue-600">
            REVV MARKETPLACE
          </p>

          <h2 className="text-3xl font-bold">
            Explore Vehicles
          </h2>

          <p className="mt-2 text-zinc-500">
            Search and compare vehicles across New Zealand.
          </p>
        </div>

        {/* Interactive search and vehicle cards */}
        <CarSearch cars={cars} />

        <p className="mt-10 text-sm text-zinc-500">
          Demonstration listings only. Vehicles displayed
          are fictional and are not currently for sale
          through REVV.
        </p>
      </section>

      {/* Intelligence teaser */}
      <section className="bg-zinc-900 px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">
            COMING SOON
          </p>

          <h2 className="text-3xl font-bold">
            REVV Intelligence
          </h2>

          <p className="mt-4 max-w-2xl text-zinc-400">
            We're developing tools for vehicle price
            tracking, market insights and AI-assisted
            valuations to help buyers make more
            informed decisions.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-950 px-6 py-8 text-white">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-3 sm:flex-row">
          <span className="text-xl font-black">
            REVV<span className="text-blue-500">.</span>
          </span>

          <p className="text-sm text-zinc-400">
            Drive Smarter. Buy Better.
          </p>
        </div>
      </footer>
    </main>
  );
}
