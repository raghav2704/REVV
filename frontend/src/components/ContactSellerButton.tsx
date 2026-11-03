
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const API = typeof window === "undefined" ? "http://127.0.0.1:8000" : window.location.origin;

export default function ContactSellerButton({
  vehicleId,
}: {
  vehicleId: number;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(
    "Hi, is this vehicle still available?"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startConversation() {
    if (busy || !message.trim()) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        `${API}/api/v1/messages/conversations`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vehicle_id: vehicleId,
            message: message.trim(),
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          setError("Please sign in to contact this seller.");
          return;
        }

        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : "Unable to contact seller."
        );
      }

      if (
        !Number.isInteger(data?.conversation_id) ||
        data.conversation_id <= 0
      ) {
        throw new Error("Invalid conversation response.");
      }

      router.push(`/messages?conversation=${data.conversation_id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor="seller-enquiry"
        className="block text-sm font-semibold text-slate-200"
      >
        Message the seller
      </label>

      <textarea
        id="seller-enquiry"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        maxLength={2000}
        rows={3}
        disabled={busy}
        className="w-full rounded-xl border border-white/15 bg-[#111E32] p-4 text-sm text-white outline-none focus:border-blue-500"
      />

      <button
        type="button"
        onClick={startConversation}
        disabled={busy || !message.trim()}
        className="w-full rounded-xl bg-blue-600 px-5 py-4 font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
      >
        {busy ? "Sending enquiry..." : "Contact Seller"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
