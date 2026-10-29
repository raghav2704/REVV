
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const API = "http://127.0.0.1:8000";

type User = {
  id: number;
  full_name: string;
  email: string;
  role: string;
};

export default function Navbar() {
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      setLoading(true);

      try {
        const response = await fetch(
          `${API}/api/v1/auth/me`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        if (!active) return;

        if (response.ok) {
          const account: User = await response.json();

          if (active) {
            setUser(account);
            setError("");
          }
        } else {
          setUser(null);

          if (response.status !== 401) {
            setError("Account status unavailable");
          }
        }
      } catch {
        if (active) {
          setError("Cannot connect to REVV API");
          setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [pathname]);

  async function logout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/v1/auth/logout`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      setUser(null);
      window.location.assign("/login");
    } catch {
      setError("Unable to log out. Please try again.");
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090d14] text-white">
      <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link
          href="/"
          className="text-3xl font-black tracking-[-0.08em]"
        >
          REV<span className="text-blue-500">V</span>
        </Link>

        <div className="flex flex-wrap items-center gap-4 text-sm font-medium sm:gap-6">
          <Link
            href="/#explore"
            className="transition hover:text-blue-400"
          >
            Explore Cars
          </Link>

          {loading ? (
            <span className="text-zinc-500">
              Checking account...
            </span>
          ) : user ? (
            <>
              <Link
                href="/my-listings"
                className="transition hover:text-blue-400"
              >
                My Listings
              </Link>

              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="font-bold text-blue-400 transition hover:text-blue-300"
                >
                  Admin Dashboard
                </Link>
              )}

              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold">
                  {user.full_name
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <span className="hidden max-w-32 truncate text-zinc-300 md:block">
                  {user.full_name.split(" ")[0]}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void logout()}
                disabled={loggingOut}
                className="rounded-lg border border-white/20 px-4 py-2.5 font-semibold transition hover:bg-white/10 disabled:opacity-50"
              >
                {loggingOut
                  ? "Logging out..."
                  : "Logout"}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="transition hover:text-blue-400"
              >
                Login
              </Link>

              <Link
                href="/register"
                className="transition hover:text-blue-400"
              >
                Sign Up
              </Link>
            </>
          )}

          <Link
            href={user ? "/sell" : "/login"}
            className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold transition hover:bg-blue-500"
          >
            Sell Your Car
          </Link>
        </div>
      </nav>

      {error && (
        <div
          role="alert"
          className="bg-red-950/70 px-6 py-2 text-center text-xs text-red-200"
        >
          {error}
        </div>
      )}
    </header>
  );
}
