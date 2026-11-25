"use client";
import Link from "next/link";
import { useRef } from "react";
import { money, type RecommendationMatch } from "./RecommendationCard";

export default function VehicleComparison({
  matches,
  clear,
}: {
  matches: RecommendationMatch[];
  clear: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const rows: {
    label: string;
    value: (item: RecommendationMatch) => string;
  }[] = [
    { label: "Asking price", value: (item) => money(item.vehicle.price_nzd) },
    { label: "Supported listing fit", value: (item) => `${item.score}%` },
    {
      label: "Recorded criteria",
      value: (item) => `${item.evidence_coverage}% of weighted criteria`,
    },
    {
      label: "Kilometres",
      value: (item) => `${item.vehicle.mileage_km.toLocaleString("en-NZ")} km`,
    },
    { label: "Year", value: (item) => String(item.vehicle.year) },
    { label: "Location", value: (item) => item.vehicle.location },
    {
      label: "Body type",
      value: (item) => item.vehicle.body_type ?? "Not recorded",
    },
    {
      label: "Fuel",
      value: (item) => item.vehicle.fuel_type ?? "Not recorded",
    },
    {
      label: "Transmission",
      value: (item) => item.vehicle.transmission ?? "Not recorded",
    },
    {
      label: "Drivetrain",
      value: (item) => item.vehicle.drivetrain ?? "Not recorded",
    },
    {
      label: "Seats",
      value: (item) =>
        item.vehicle.seats == null
          ? "Not recorded"
          : String(item.vehicle.seats),
    },
    {
      label: "Engine",
      value: (item) =>
        item.vehicle.engine_cc
          ? `${item.vehicle.engine_cc.toLocaleString("en-NZ")} cc`
          : item.vehicle.fuel_type === "Electric"
            ? "Electric; no engine capacity"
            : "Not recorded",
    },
    {
      label: "Budget trade-off",
      value: (item) =>
        item.over_budget_nzd
          ? `${money(item.over_budget_nzd)} above ceiling`
          : `${money(item.budget_headroom_nzd ?? 0)} below ceiling`,
    },
    {
      label: "Unmet preferences",
      value: (item) => item.unmet_preferences.join(" · ") || "None recorded",
    },
    {
      label: "Unknown requirements",
      value: (item) =>
        item.unknown_preferences.join(" · ") ||
        "None for the selected criteria",
    },
  ];
  if (!matches.length) return null;
  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-300/30 bg-[#081323f5] px-5 py-3 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-300">
            <strong className="text-white">{matches.length} / 3</strong>{" "}
            selected for comparison
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={clear}
              className="min-h-11 px-3 text-xs text-slate-400 hover:text-white"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={matches.length < 2}
              onClick={() => dialog.current?.showModal()}
              className="min-h-11 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-40"
            >
              Compare vehicles ↗
            </button>
          </div>
        </div>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="comparison-heading"
        className="fixed inset-0 m-auto max-h-[90svh] w-[min(1100px,95vw)] overflow-auto rounded-2xl border border-[#354e70] bg-[#0c192c] p-5 text-white shadow-2xl backdrop:bg-slate-950/85 sm:p-8"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[.2em] text-blue-400">
              YOUR SHORTLIST / SIDE BY SIDE
            </p>
            <h2 id="comparison-heading" className="mt-2 text-2xl font-semibold">
              Compare the facts.
            </h2>
          </div>
          <form method="dialog">
            <button
              className="min-h-11 rounded-lg border border-white/20 px-4 text-xs"
              aria-label="Close comparison"
            >
              Close ×
            </button>
          </form>
        </div>
        <p className="mb-5 text-xs leading-6 text-slate-400">
          Listing facts only. A missing specification is unknown, and a match
          score is not a vehicle-quality rating. Listings can change; check the
          detail page before enquiring.
        </p>
        <p className="mb-3 text-xs text-blue-300 sm:hidden">Swipe across the table to compare all selected vehicles →</p>
        <div
          className="overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Vehicle comparison table"
        >
          <table className="w-full min-w-[600px] border-collapse text-left text-xs leading-6">
            <thead>
              <tr>
                <th scope="col" className="w-36 p-3 text-slate-500">
                  Criterion
                </th>
                {matches.map((item) => (
                  <th
                    scope="col"
                    key={item.vehicle.id}
                    className="min-w-48 p-3 align-top"
                  >
                    <Link
                      className="text-base font-bold text-white hover:text-blue-300"
                      href={item.listing_url}
                    >
                      {item.vehicle.year} {item.vehicle.make}{" "}
                      {item.vehicle.model}
                    </Link>
                    {item.is_demo && (
                      <span className="mt-2 block text-[10px] text-amber-200">
                        DEMO — NOT FOR SALE
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-white/10">
                  <th
                    scope="row"
                    className="p-3 align-top font-medium text-slate-400"
                  >
                    {row.label}
                  </th>
                  {matches.map((item) => (
                    <td
                      key={item.vehicle.id}
                      className="p-3 align-top text-slate-200"
                    >
                      {row.value(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </dialog>
    </>
  );
}
