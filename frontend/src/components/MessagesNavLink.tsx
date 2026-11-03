
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API = typeof window === "undefined" ? "http://127.0.0.1:8000" : window.location.origin;

type Thread = {
  id: number;
  unread_count: number;
};

export default function MessagesNavLink() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch(
          `${API}/api/v1/messages/conversations`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          if (active) setUnread(0);
          return;
        }

        const result: { data: Thread[] } =
          await response.json();

        if (!active || !Array.isArray(result.data)) {
          return;
        }

        setUnread(
          result.data.reduce(
            (sum, thread) =>
              sum + Number(thread.unread_count || 0),
            0
          )
        );
      } catch {
        // Keep the navigation usable during API interruptions.
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
    <Link
      href="/messages"
      className="relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"
    >
      <span aria-hidden="true">💬</span>
      Messages

      {unread > 0 && (
        <span className="flex min-h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
