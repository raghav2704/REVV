
"use client";

import { useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

type Photo = {
  id?: number;
  image_url?: string | null;
  url?: string | null;
  file_url?: string | null;
  path?: string | null;
  is_cover?: boolean;
  is_primary?: boolean;
  sort_order?: number;
};

type Props = {
  vehicleId: number;
  title: string;
  className?: string;
};

function photoUrl(photo: Photo): string | null {
  const value =
    photo.image_url ??
    photo.url ??
    photo.file_url ??
    photo.path;

  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    const resolved = new URL(value, API);

    // Only display photos served by the local REVV app.
    const allowed = [
      "http://127.0.0.1:8000",
      "http://localhost:8000",
      "http://127.0.0.1:3000",
      "http://localhost:3000",
      "http://127.0.0.1:3001",
      "http://localhost:3001",
    ];

    return allowed.includes(resolved.origin)
      ? resolved.href
      : null;
  } catch {
    return null;
  }
}

export default function SellerVehicleCover({
  vehicleId,
  title,
  className = "",
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    setSrc(null);
    setFailed(false);
    setLoading(true);

    async function load() {
      try {
        const response = await fetch(
          `${API}/api/v1/cars/${vehicleId}/images`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          throw new Error("Could not fetch photos");
        }

        const data: { images?: Photo[] } =
          await response.json();

        const photos = Array.isArray(data.images)
          ? [...data.images]
          : [];

        photos.sort((a, b) => {
          const aCover = a.is_cover || a.is_primary ? 1 : 0;
          const bCover = b.is_cover || b.is_primary ? 1 : 0;

          if (aCover !== bCover) {
            return bCover - aCover;
          }

          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        });

        const selected = photos
          .map(photoUrl)
          .find((url) => url !== null);

        if (active) setSrc(selected ?? null);
      } catch {
        if (active) setSrc(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [vehicleId]);

  return (
    <div
      className={`relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1A304E] to-[#091321] ${className}`}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={title}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
          <svg
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 17h14l-1-6-2-4H8l-2 4-1 6Z" />
            <path d="M5 13h14" />
            <circle cx="7.5" cy="17" r="1.5" />
            <circle cx="16.5" cy="17" r="1.5" />
          </svg>

          <span className="text-xs font-semibold">
            {loading ? "Loading photo..." : "No photo available"}
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
    </div>
  );
}
