
import Link from "next/link";

export default function Navbar() {
  return (
    <header className="bg-zinc-950 px-6 py-5 text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <Link
          href="/"
          className="text-3xl font-black tracking-tight"
        >
          REVV<span className="text-blue-500">.</span>
        </Link>

        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="/#explore" className="hover:text-blue-400">
            Explore Cars
          </Link>

          <span className="hidden text-zinc-400 sm:inline">
            Sell Your Car — Coming Soon
          </span>
        </div>
      </nav>
    </header>
  );
}
