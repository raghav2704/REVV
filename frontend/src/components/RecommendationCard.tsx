"use client";
import Link from "next/link";
import { useState } from "react";
import type { Car } from "@/components/CarSearch";

export type RecommendationMatch = {
  vehicle: Car & { seats: number | null };
  photo_url: string | null;
  listing_url: string;
  is_demo: boolean;
  score: number;
  known_fit: number;
  budget_headroom_nzd: number;
  score_breakdown: {
    criterion: string;
    label: string;
    weight: number;
    weight_share_percent: number;
    fit_percent: number | null;
    status: "matched" | "partial" | "unmet" | "unknown";
    explanation: string;
    score_points: number;
  }[];
  evidence_coverage: number;
  reasons: string[];
  unmet_preferences: string[];
  unknown_preferences: string[];
  over_budget_nzd: number;
  all_preferences_satisfied: boolean;
};
export const money = (value: number) =>
  new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    maximumFractionDigits: 0,
  }).format(value);
export default function RecommendationCard({
  match,
  selected = false,
  compareDisabled = false,
  onCompare,
}: {
  match: RecommendationMatch;
  selected?: boolean;
  compareDisabled?: boolean;
  onCompare?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const car = match.vehicle;
  const title = `${car.year} ${car.make} ${car.model}`;
  return (
    <article className="overflow-hidden rounded-2xl border border-[#293d57] bg-[#102038] shadow-lg">
      <Link
        href={match.listing_url}
        className="relative block aspect-[16/10] overflow-hidden bg-[#0b1627]"
        aria-label={`View ${title}${match.is_demo ? " — DEMO — NOT FOR SALE" : ""}`}
      >
        {match.photo_url &&
        !failed /* Existing local, authorized REVV photo URLs. */ ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={match.photo_url}
            alt={title}
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition duration-300 hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
            <svg
              viewBox="0 0 80 40"
              width="76"
              height="38"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M9 29V19l8-3 8-10h30l9 10 8 4v9H9Z" />
              <path d="m24 7-5 10h41L53 7M34 7v10" />
              <circle cx="23" cy="30" r="5" />
              <circle cx="59" cy="30" r="5" />
            </svg>
            <span className="text-xs">No listing photo available</span>
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-[#081323e6] px-3 py-1.5 text-xs font-bold text-white">
          {match.score}% supported fit
        </span>
        {match.is_demo && (
          <span className="absolute inset-x-0 bottom-0 bg-amber-300 px-3 py-2 text-center text-[10px] font-black tracking-wider text-amber-950">
            DEMO — NOT FOR SALE
          </span>
        )}
      </Link>
      <div className="space-y-4 p-5">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-white">
            <Link href={match.listing_url}>{title}</Link>
          </h3>
          {car.variant && (
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {car.variant}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <strong className="text-2xl tracking-tight text-white">
            {money(car.price_nzd)}
          </strong>
          <span className="text-xs text-slate-400">
            {car.mileage_km.toLocaleString("en-NZ")} km · {car.location}
          </span>
        </div>
        {match.over_budget_nzd > 0 && (
          <p className="rounded-lg bg-amber-400/10 p-2 text-xs font-semibold text-amber-200">
            Over budget by {money(match.over_budget_nzd)} — near match only
          </p>
        )}
        <ul className="space-y-2 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-300">
          {match.reasons.map((reason) => (
            <li key={reason} className="flex gap-2">
              <span className="text-blue-400" aria-hidden="true">
                ✓
              </span>
              {reason}
            </li>
          ))}
        </ul>
        {match.unmet_preferences.length > 0 && (
          <div className="text-xs leading-relaxed text-amber-200">
            <p className="mb-1 font-semibold">Preferences not met</p>
            <ul className="list-disc space-y-1 pl-4">
              {match.unmet_preferences.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
        {match.unknown_preferences.length > 0 && (
          <div className="rounded-xl bg-[#091526] p-3 text-xs leading-relaxed text-slate-400">
            <p className="mb-1 font-semibold text-slate-300">
              Not enough information
            </p>
            <ul className="space-y-1">
              {match.unknown_preferences.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        )}
        <details className="rounded-xl border border-white/10 p-3">
          <summary className="cursor-pointer text-xs font-semibold text-blue-200">
            How this score is calculated
          </summary>
          <p className="mt-3 text-[10px] leading-5 text-slate-400">
            Supported fit includes all your weighted criteria. Unknown
            information earns no match points, but is not a negative judgement
            about the car. Fit on recorded criteria:{" "}
            {match.known_fit ?? match.score}%.
          </p>
          <div className="mt-3 space-y-3">
            {(match.score_breakdown ?? []).map((item) => (
              <div key={item.criterion}>
                <div className="flex justify-between gap-2 text-[10px]">
                  <span className="font-semibold text-slate-200">
                    {item.label}
                  </span>
                  <span className="text-slate-400">
                    {item.weight_share_percent}% weight ·{" "}
                    {item.fit_percent == null
                      ? "Unknown"
                      : `${item.fit_percent}% fit`}
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-700"
                  aria-hidden="true"
                >
                  <div
                    className={`h-full rounded-full ${item.status === "unknown" ? "bg-slate-500" : item.status === "unmet" ? "bg-amber-400" : "bg-blue-400"}`}
                    style={{ width: `${item.fit_percent ?? 0}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] leading-5 text-slate-500">
                  {item.explanation}
                </p>
              </div>
            ))}
          </div>
        </details>
        {onCompare && (
          <button
            type="button"
            aria-pressed={selected}
            disabled={compareDisabled}
            onClick={onCompare}
            className={`min-h-11 w-full rounded-xl border px-4 text-xs font-semibold transition disabled:opacity-40 ${selected ? "border-blue-400 bg-blue-500/20 text-blue-100" : "border-white/20 text-slate-300 hover:border-blue-400"}`}
          >
            {selected ? "✓ Added to comparison" : "+ Compare this vehicle"}
          </button>
        )}
        <p className="text-[10px] leading-relaxed text-slate-500">
          Evidence available for {match.evidence_coverage}% of the weighted
          criteria. Unknown criteria cannot earn match points.
        </p>
        <Link
          href={match.listing_url}
          className="flex min-h-11 items-center justify-between rounded-xl border border-blue-400/40 px-4 py-3 text-xs font-bold text-blue-200 transition hover:bg-blue-500/15"
        >
          View vehicle <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </article>
  );
}
