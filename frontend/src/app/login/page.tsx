
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

const API_URL = "http://127.0.0.1:8000";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    console.log("REVV login form submitted");

    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/v1/auth/login`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            password,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      console.log("REVV login response status:", response.status);

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Login failed. Please try again."
        );
      }

      // Verify that the browser retained the session cookie.
      const sessionResponse = await fetch(
        `${API_URL}/api/v1/auth/me`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      if (!sessionResponse.ok) {
        throw new Error(
          "Login succeeded, but your browser did not retain the session. Open REVV at http://127.0.0.1:3000/login and check your backend CORS settings."
        );
      }

      console.log("REVV session verified. Redirecting.");

      // Use a full navigation rather than client-side routing.
      window.location.assign("/");
    } catch (err) {
      console.error("REVV login error:", err);

      if (err instanceof TypeError) {
        setError(
          "Cannot connect to the REVV API. Check that FastAPI is running on port 8000 and CORS allows your frontend."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "mt-2 w-full rounded-xl border border-white/10 bg-[#111c2d] px-4 py-3 text-white outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080e18] px-6 py-16 text-white">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="text-sm font-medium text-blue-400 transition hover:text-blue-300"
        >
          ← Back to REVV
        </Link>

        <div className="mt-10 rounded-3xl border border-white/10 bg-[#0d1726] p-8 shadow-2xl md:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
            REVV / MEMBER ACCESS
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight">
            Welcome back.
          </h1>

          <p className="mt-3 text-sm text-zinc-400">
            Sign in to your REVV account to continue.
          </p>

          <form
            onSubmit={handleLogin}
            noValidate={false}
            className="mt-8 space-y-6"
          >
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-medium text-zinc-200"
              >
                Email Address
              </label>

              <input
                id="login-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                maxLength={254}
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-zinc-200"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  className={`${inputClass} pr-20`}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  className="absolute right-4 top-1/2 translate-y-[-25%] text-xs font-semibold text-blue-400 hover:text-blue-300"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-8 border-t border-white/10 pt-6 text-center">
            <p className="text-sm text-zinc-400">
              New to REVV?{" "}
              <Link
                href="/register"
                className="font-semibold text-blue-400 hover:text-blue-300"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Drive Smarter. Buy Better.
        </p>
      </div>
    </main>
  );
}
