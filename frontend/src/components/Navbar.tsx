
import Link from "next/link";

export default function Navbar() {
  return (
    <header className="border-b border-white/10 bg-[#090d14] px-6 py-5 text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link
          href="/"
          className="text-3xl font-black tracking-[-0.08em]"
        >
          REV<span className="text-blue-500">V</span>
        </Link>

        <div className="flex items-center gap-5 text-sm font-medium sm:gap-8">
          <Link
            href="/#explore"
            className="transition hover:text-blue-400"
          >
            Explore Cars
          </Link>

          <Link
            href="/sell"
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white transition hover:bg-blue-500"
          >
            Sell Your Car
          </Link>
        </div>
      </nav>
    </header>
  );
}
