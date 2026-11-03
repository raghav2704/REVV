
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API = typeof window === "undefined" ? "http://127.0.0.1:8000" : window.location.origin;

export default function DealsNavLinks() {
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch(
          `${API}/api/v1/deals/notifications/summary`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        if (!response.ok) return;

        const data = await response.json();

        if (active) {
          setPending(Number(data.offers_awaiting_response || 0));
        }
      } catch {
        // Navigation should remain usable without notifications.
      }
    }

    void refresh();

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 10000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <>
      <Link
        href="/watchlist"
        className="transition hover:text-blue-400"
      >
        ♡ Watchlist
      </Link>

      <Link
        href="/offers"
        className="inline-flex items-center gap-2 transition hover:text-blue-400"
      >
        Offers

        {pending > 0 && (
          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-bold text-white">
            {pending > 99 ? "99+" : pending}
          </span>
        )}
      </Link>

      <Link
        href="/seller-studio"
        className="transition hover:text-blue-400"
      >
        Seller Studio
      </Link>
    </>
  );
}
