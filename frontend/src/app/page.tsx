
type Car = {
  id: number;
  make: string;
  model: string;
  year: number;
  price_nzd: number;
  mileage_km: number;
  location: string;
};

async function getCars(): Promise<Car[]> {
  const response = await fetch(
    "http://127.0.0.1:8000/api/v1/cars",
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Failed to load vehicles");
  }

  const result = await response.json();
  return result.data;
}

export default async function Home() {
  const cars = await getCars();

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="bg-zinc-950 px-6 py-5 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-3xl font-black tracking-tight">
            REVV<span className="text-blue-500">.</span>
          </h1>
          <span className="text-sm text-zinc-400">
            Buy. Sell. Compare.
          </span>
        </div>
      </header>

      <section className="bg-zinc-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="mb-4 text-sm font-semibold tracking-widest text-blue-400">
            AUTOMOTIVE MARKETPLACE
          </p>
          <h2 className="max-w-2xl text-5xl font-bold">
            Find your next drive.
          </h2>
          <p className="mt-5 max-w-xl text-lg text-zinc-400">
            Discover vehicles, compare prices and make
            smarter buying decisions with REVV.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold">
            Explore Vehicles
          </h2>
          <span className="text-sm text-zinc-500">
            {cars.length} listings
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {cars.map((car) => (
            <article
              key={car.id}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
            >
              <div className="flex h-44 items-center justify-center bg-zinc-200 text-zinc-500">
                Vehicle photo coming soon
              </div>

              <div className="p-5">
                <h3 className="text-xl font-bold">
                  {car.year} {car.make} {car.model}
                </h3>

                <p className="mt-3 text-2xl font-bold text-blue-600">
                  {new Intl.NumberFormat("en-NZ", {
                    style: "currency",
                    currency: "NZD",
                    maximumFractionDigits: 0,
                  }).format(car.price_nzd)}
                </p>

                <div className="mt-4 flex justify-between text-sm text-zinc-500">
                  <span>
                    {car.mileage_km.toLocaleString("en-NZ")} km
                  </span>
                  <span>{car.location}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-8 text-sm text-zinc-500">
          Demonstration listings only. No vehicles are
          currently advertised for sale through REVV.
        </p>
      </section>
    </main>
  );
}
