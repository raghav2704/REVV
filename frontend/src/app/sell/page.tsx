
import type { Metadata } from "next";
import Link from "next/link";
import SellCarForm from "@/components/SellCarForm";

export const metadata: Metadata = {
  title: "Sell Your Car | REVV",
  description:
    "Create a vehicle listing on the REVV automotive marketplace.",
};

export default function SellPage() {
  return (
    <main className="min-h-screen bg-[#080e18] text-white">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#12253f] via-[#0b1423] to-[#070b12] px-6 py-20">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative mx-auto max-w-5xl">
          <Link
            href="/"
            className="text-sm text-blue-300 transition hover:text-white"
          >
            ← Back to REVV
          </Link>

          <p className="mt-10 text-xs font-bold uppercase tracking-[0.3em] text-blue-400">
            REVV MARKETPLACE
          </p>

          <h1 className="mt-5 text-5xl font-black tracking-tight md:text-6xl">
            Your car.
            <span className="block text-blue-400">
              Your listing.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
            Create a vehicle listing in just a few
            steps. Enter your car's details and
            preview it on REVV.
          </p>
        </div>
      </section>

      {/* SELL FORM */}
      <section className="px-6 py-14 md:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/15 text-xl text-blue-400">
              🚘
            </div>

            <div>
              <h2 className="text-xl font-bold">
                Create vehicle listing
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Complete the form below to continue.
              </p>
            </div>
          </div>

          <SellCarForm />
        </div>
      </section>
    </main>
  );
}
