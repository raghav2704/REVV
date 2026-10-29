
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const API = "http://127.0.0.1:8000";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (
      password.length < 8 ||
      !/[A-Za-z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      setError(
        "Password must have at least 8 characters, a letter and a number."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/v1/auth/register`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim(),
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Unable to create account."
        );
      }

      router.push("/login");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  }

  const inputStyle =
    "mt-2 w-full rounded-xl border border-white/10 bg-[#111c2d] px-4 py-3 outline-none focus:border-blue-500";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080e18] px-6 py-16 text-white">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          ← Back to REVV
        </Link>

        <div className="mt-10 rounded-3xl border border-white/10 bg-[#0d1726] p-8 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">
            REVV / JOIN THE DRIVE
          </p>

          <h1 className="mt-4 text-4xl font-black">
            Create an account.
          </h1>

          <p className="mt-3 text-sm text-zinc-400">
            Join REVV to buy, sell and explore cars.
          </p>

          <form onSubmit={handleRegister} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="register-name"
                className="text-sm font-medium"
              >
                Full Name
              </label>

              <input
                id="register-name"
                type="text"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className={inputStyle}
              />
            </div>

            <div>
              <label
                htmlFor="register-email"
                className="text-sm font-medium"
              >
                Email Address
              </label>

              <input
                id="register-email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputStyle}
              />
            </div>

            <div>
              <label
                htmlFor="register-password"
                className="text-sm font-medium"
              >
                Password
              </label>

              <input
                id="register-password"
                type="password"
                required
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className={inputStyle}
              />

              <p className="mt-2 text-xs text-zinc-500">
                At least 8 characters with a letter and number.
              </p>
            </div>

            <div>
              <label
                htmlFor="register-confirm"
                className="text-sm font-medium"
              >
                Confirm Password
              </label>

              <input
                id="register-confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) =>
                  setConfirmPassword(e.target.value)
                }
                placeholder="Confirm your password"
                className={inputStyle}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-5 py-3.5 font-bold transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-blue-400 hover:text-blue-300"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
