"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import VehicleComparison from "./VehicleComparison";
import RecommendationCard, {
  money,
  type RecommendationMatch as Match,
} from "./RecommendationCard";

type Make = { id: number; name: string };
type Model = { id: number; name: string; make_id: number };
type Personal =
  | "sporty"
  | "reliability"
  | "efficiency"
  | "family"
  | "luxury"
  | "running_costs";
type Filter =
  | "makes"
  | "models"
  | "body_type"
  | "min_year"
  | "max_mileage"
  | "fuel_type"
  | "transmission"
  | "drivetrain"
  | "location"
  | "min_seats";
type Result = {
  provider: "rules";
  matches: Match[];
  near_matches: Match[];
  notes: string[];
  interpreted: Record<string, unknown>;
  preferences: Record<string, unknown>;
  candidates_considered: number;
  empty_message: string | null;
  summary: { within_budget: number; over_budget: number };
  relaxation_options: {
    field: Filter | "include_near_matches";
    label: string;
    action: "soften" | "near" | "edit_text";
  }[];
};
const PERSONAL: {
  key: Personal;
  label: string;
  detail: string;
  icon: string;
}[] = [
  {
    key: "sporty",
    label: "Sporty / performance",
    detail: "Verified performance data needed",
    icon: "↗",
  },
  {
    key: "reliability",
    label: "Reliability",
    detail: "Verified reliability data needed",
    icon: "◇",
  },
  {
    key: "efficiency",
    label: "Fuel efficiency",
    detail: "Consumption figures needed",
    icon: "◌",
  },
  {
    key: "family",
    label: "Family practicality",
    detail: "Uses listed seating; space unverified",
    icon: "⊞",
  },
  {
    key: "luxury",
    label: "Comfort / luxury",
    detail: "Verified equipment data needed",
    icon: "✧",
  },
  {
    key: "running_costs",
    label: "Low running costs",
    detail: "Ownership-cost data needed",
    icon: "$",
  },
];
const OPTIONS: Record<string, string[]> = {
  body_type: [
    "Sedan",
    "SUV",
    "Hatchback",
    "Coupe",
    "Wagon",
    "Ute",
    "Van",
    "Convertible",
    "People Mover",
    "Other",
  ],
  fuel_type: [
    "Petrol",
    "Diesel",
    "Hybrid",
    "Plug-in Hybrid",
    "Electric",
    "Other",
  ],
  transmission: ["Automatic", "Manual", "CVT", "Other"],
  drivetrain: ["FWD", "RWD", "AWD", "4WD", "Other"],
};
const LOCATIONS = [
  "Auckland",
  "Wellington",
  "Christchurch",
  "Hamilton",
  "Tauranga",
  "Dunedin",
  "Queenstown",
  "Nelson",
  "Napier",
  "Palmerston North",
  "New Plymouth",
  "Whangarei",
  "Invercargill",
];
const input =
  "w-full rounded-xl border border-[#31445f] bg-[#0b1729] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 disabled:opacity-50";
const label = "mb-2 block text-xs font-semibold tracking-wide text-slate-300";
const FILTER_NAMES: Record<Filter, string> = {
  makes: "Manufacturer",
  models: "Model",
  body_type: "Body type",
  min_year: "Minimum year",
  max_mileage: "Maximum kilometres",
  fuel_type: "Fuel type",
  transmission: "Transmission",
  drivetrain: "Drivetrain",
  location: "Location",
  min_seats: "Minimum seats",
};

function scrollToFinderSection(element: HTMLElement | null) {
  if (!element) return;
  const height =
    document.querySelector("body > header")?.getBoundingClientRect().height ??
    80;
  element.style.scrollMarginTop = `${height + 24}px`;
  element.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    block: "start",
  });
}

export default function SmartCarFinder() {
  const [maximum, setMaximum] = useState("");
  const [minimum, setMinimum] = useState("");
  const [near, setNear] = useState(false);
  const [excludeDemo, setExcludeDemo] = useState(false);
  const [excludedMakes, setExcludedMakes] = useState<string[]>([]);
  const [excludedFuels, setExcludedFuels] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("match");
  const [importance, setImportance] = useState<Record<string, number>>({});
  const [compared, setCompared] = useState<Match[]>([]);
  function toggleCompare(match: Match) {
    setCompared((old) =>
      old.some((item) => item.vehicle.id === match.vehicle.id)
        ? old.filter((item) => item.vehicle.id !== match.vehicle.id)
        : old.length < 3
          ? [...old, match]
          : old,
    );
  }
  const [text, setText] = useState("");
  const [makes, setMakes] = useState<Make[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedMakes, setSelectedMakes] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [mandatory, setMandatory] = useState<Filter[]>([]);
  const [priorities, setPriorities] = useState<
    Partial<Record<Personal, number>>
  >({});
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [changed, setChanged] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const results = useRef<HTMLElement>(null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/v1/vehicle-makes", { signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<Make[]>;
      })
      .then(setMakes)
      .catch(() => {
        if (!abort.signal.aborted)
          setCatalogError(
            "Manufacturer choices are unavailable. You can still describe your preferred make in the text box.",
          );
      });
    return () => {
      abort.abort();
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    const abort = new AbortController();
    const chosen = makes.filter((make) => selectedMakes.includes(make.name));
    Promise.all(
      chosen.map(async (make) => {
        const response = await fetch(
          `/api/v1/vehicle-makes/${make.id}/models`,
          { signal: abort.signal },
        );
        if (!response.ok) throw new Error();
        return response.json() as Promise<Model[]>;
      }),
    )
      .then((values) => setModels(values.flat()))
      .catch(() => {
        if (!abort.signal.aborted)
          setCatalogError(
            "Model choices are unavailable. Other filters still work.",
          );
      });
    return () => abort.abort();
  }, [makes, selectedMakes]);
  const dirty = () => {
    if (result) setChanged(true);
  };
  function required(key: Filter, available: boolean) {
    return (
      <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
        <input
          type="checkbox"
          className="accent-blue-500"
          disabled={!available}
          checked={mandatory.includes(key)}
          onChange={(event) => {
            dirty();
            setMandatory((old) =>
              event.target.checked
                ? [...old, key]
                : old.filter((item) => item !== key),
            );
          }}
        />
        Must have · {FILTER_NAMES[key].toLowerCase()}
      </label>
    );
  }
  function choose(key: string, value: string) {
    dirty();
    setFilters((old) => ({ ...old, [key]: value }));
    if (!value) setMandatory((old) => old.filter((item) => item !== key));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true);
    setError("");
    const body: Record<string, unknown> = {
      text,
      include_near_matches: near,
      exclude_demo: excludeDemo,
      exclude_makes: excludedMakes,
      exclude_fuels: excludedFuels,
      sort_by: sortBy,
      criterion_importance: importance,
      makes: selectedMakes,
      models: selectedModels,
      mandatory,
      priorities,
      limit: 8,
    };
    if (maximum !== "") body.max_budget = Number(maximum);
    if (minimum !== "") body.min_budget = Number(minimum);
    for (const [key, value] of Object.entries(filters))
      if (value !== "")
        body[key] =
          key === "min_year" || key === "max_mileage" || key === "min_seats"
            ? Number(value)
            : value;
    try {
      const response = await fetch("/api/v1/recommendations/cars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abort.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Too many searches. Please wait a minute and try again."
            : typeof data.detail === "string"
              ? data.detail
              : "Please check your budget and filter values, then try again.",
        );
      setResult(data as Result);
      setCompared([]);
      setChanged(false);
      requestAnimationFrame(() => scrollToFinderSection(results.current));
    } catch (failure) {
      if (!abort.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "We couldn’t search REVV. Please try again.",
        );
    } finally {
      if (!abort.signal.aborted) setLoading(false);
    }
  }
  const modelNames = [...new Set(models.map((model) => model.name))].sort();
  return (
    <main
      className={`min-h-screen bg-[#081221] text-white ${compared.length ? "pb-40" : "pb-20"}`}
    >
      <div className="border-b border-white/10 bg-[radial-gradient(ellipse_at_top_right,#193b7144,transparent_60%)]">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="mb-6 flex flex-wrap items-center gap-3 text-[10px] font-bold tracking-[.18em]">
            <span className="text-blue-400">REVV SMART CAR FINDER</span>
            <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-blue-200">
              FREE · RULE-BASED MATCHING
            </span>
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-[-.045em] sm:text-6xl">
            Your next car.
            <br />
            <span className="text-blue-400">A better fit.</span>
          </h1>
          <p className="mt-6 max-w-xl text-sm leading-7 text-slate-400">
            Start with your budget and what matters to you. We’ll rank active
            REVV listings and explain the fit, the trade-offs and what we can’t
            verify.
          </p>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-300">
            <span>01 &nbsp; Set your budget</span>
            <span>02 &nbsp; Choose your priorities</span>
            <span>03 &nbsp; Explore your matches</span>
          </div>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-8 px-5 pt-9 sm:px-8 lg:grid-cols-[380px_minmax(0,1fr)]">
        <form
          ref={form}
          onSubmit={(event) => void submit(event)}
          onChange={dirty}
        >
          <fieldset disabled={loading} className="min-w-0 space-y-5">
            <section
              className="rounded-2xl border border-[#293d57] bg-[#102038] p-5 sm:p-6"
              aria-labelledby="budget-heading"
            >
              <p className="text-[10px] font-bold tracking-[.2em] text-blue-400">
                01 / YOUR BUDGET
              </p>
              <h2
                id="budget-heading"
                className="mb-5 mt-2 text-xl font-semibold tracking-tight"
              >
                What works for you?
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <label className={label}>
                  Minimum NZD{" "}
                  <span className="font-normal text-slate-500">(optional)</span>
                  <input
                    aria-label="Minimum budget NZD"
                    type="number"
                    min="0"
                    max="100000000"
                    step="1"
                    value={minimum}
                    onChange={(event) => setMinimum(event.target.value)}
                    placeholder="No minimum"
                    className={`${input} mt-2`}
                  />
                </label>
                <label className={label}>
                  Maximum NZD
                  <input
                    aria-label="Maximum budget NZD"
                    type="number"
                    min="1000"
                    max="100000000"
                    step="1"
                    value={maximum}
                    onChange={(event) => setMaximum(event.target.value)}
                    placeholder="35,000"
                    className={`${input} mt-2`}
                  />
                </label>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">
                Enter a maximum here or include an amount such as $35,000 in
                your description.
              </p>
              <label className="mt-4 flex items-start gap-3 rounded-xl border border-white/10 p-3 text-xs leading-5 text-slate-300">
                <input
                  type="checkbox"
                  className="mt-1 accent-blue-500"
                  checked={near}
                  onChange={(event) => setNear(event.target.checked)}
                />
                <span>
                  Show near matches up to 10% above budget
                  <span className="block text-[10px] text-slate-500">
                    Always separate from your within-budget results.
                  </span>
                </span>
              </label>
              <label className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                <input
                  type="checkbox"
                  className="accent-blue-500"
                  checked={excludeDemo}
                  onChange={(event) => setExcludeDemo(event.target.checked)}
                />
                Hide marked demo listings
              </label>
              <label htmlFor="finder-description" className={`${label} mt-5`}>
                Describe your ideal vehicle
              </label>
              <textarea
                id="finder-description"
                maxLength={1000}
                rows={4}
                value={text}
                onChange={(event) => setText(event.target.value)}
                className={`${input} resize-y leading-6`}
                placeholder="I have $35,000 and want a sporty European sedan with low kilometres."
              />
              <p className="mt-2 text-[10px] leading-5 text-slate-500">
                Simple keyword rules, not a generative AI model. Your
                description isn’t stored. No paid AI service is used.
              </p>
            </section>
            <section
              className="rounded-2xl border border-[#293d57] bg-[#102038] p-5 sm:p-6"
              aria-labelledby="priority-heading"
            >
              <p className="text-[10px] font-bold tracking-[.2em] text-blue-400">
                02 / WHAT MATTERS
              </p>
              <h2
                id="priority-heading"
                className="mb-2 mt-2 text-xl font-semibold tracking-tight"
              >
                Make it your kind of drive.
              </h2>
              <p className="mb-5 text-xs leading-6 text-slate-400">
                Choose preferences, then set their importance. We’ll flag
                missing evidence rather than guess.
              </p>
              <div className="space-y-2">
                {PERSONAL.map((item) => (
                  <div
                    key={item.key}
                    className={`rounded-xl border p-3 ${priorities[item.key] ? "border-blue-400/50 bg-blue-500/10" : "border-white/10"}`}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 accent-blue-500"
                        checked={!!priorities[item.key]}
                        onChange={(event) =>
                          setPriorities((old) => {
                            const next = { ...old };
                            if (event.target.checked) next[item.key] = 2;
                            else delete next[item.key];
                            return next;
                          })
                        }
                      />
                      <span className="flex-1">
                        <span className="block text-xs font-semibold">
                          {item.label}
                        </span>
                        <span className="mt-1 block text-[10px] text-slate-500">
                          {item.detail}
                        </span>
                      </span>
                      <span className="text-blue-400" aria-hidden="true">
                        {item.icon}
                      </span>
                    </label>
                    {priorities[item.key] && (
                      <select
                        aria-label={`${item.label} importance`}
                        value={priorities[item.key]}
                        onChange={(event) =>
                          setPriorities((old) => ({
                            ...old,
                            [item.key]: Number(event.target.value),
                          }))
                        }
                        className={`${input} mt-3 !py-2 !text-xs`}
                      >
                        <option value="1">Nice to have</option>
                        <option value="2">Important</option>
                        <option value="3">Top priority</option>
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </section>
            <details className="rounded-2xl border border-[#293d57] bg-[#102038] p-5 sm:p-6">
              <summary className="cursor-pointer text-sm font-semibold">
                03 / Refine your vehicle preferences
              </summary>
              <p className="mb-5 mt-3 text-xs leading-6 text-slate-400">
                Filters are preferences unless you select “Must have”. Budget is
                always required.
              </p>
              {catalogError && (
                <p className="mb-4 text-xs text-amber-200" role="status">
                  {catalogError}
                </p>
              )}
              <label htmlFor="finder-make" className={label}>
                Preferred manufacturers
              </label>
              <select
                id="finder-make"
                className={input}
                value=""
                disabled={selectedMakes.length >= 12}
                onChange={(event) => {
                  if (event.target.value)
                    setSelectedMakes((old) => [...old, event.target.value]);
                }}
              >
                <option value="">Add a manufacturer</option>
                {makes
                  .filter((make) => !selectedMakes.includes(make.name))
                  .map((make) => (
                    <option key={make.id}>{make.name}</option>
                  ))}
              </select>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedMakes.map((make) => (
                  <button
                    type="button"
                    key={make}
                    aria-label={`Remove ${make}`}
                    onClick={() => {
                      dirty();
                      setSelectedMakes((old) =>
                        old.filter((item) => item !== make),
                      );
                      setSelectedModels([]);
                      setMandatory((old) =>
                        old.filter(
                          (item) =>
                            item !== "models" &&
                            (item !== "makes" || selectedMakes.length > 1),
                        ),
                      );
                    }}
                    className="rounded-full bg-blue-500/20 px-3 py-1.5 text-[11px] text-blue-200"
                  >
                    {make} ×
                  </button>
                ))}
              </div>
              {required("makes", selectedMakes.length > 0)}
              <label htmlFor="finder-model" className={`${label} mt-5`}>
                Preferred models
              </label>
              <select
                id="finder-model"
                value=""
                disabled={!selectedMakes.length || selectedModels.length >= 12}
                className={input}
                onChange={(event) => {
                  if (event.target.value)
                    setSelectedModels((old) => [...old, event.target.value]);
                }}
              >
                <option value="">
                  {selectedMakes.length
                    ? "Add a model"
                    : "Choose a manufacturer first"}
                </option>
                {modelNames
                  .filter((name) => !selectedModels.includes(name))
                  .map((name) => (
                    <option key={name}>{name}</option>
                  ))}
              </select>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedModels.map((model) => (
                  <button
                    type="button"
                    key={model}
                    aria-label={`Remove model ${model}`}
                    onClick={() => {
                      dirty();
                      setSelectedModels((old) =>
                        old.filter((item) => item !== model),
                      );
                      if (selectedModels.length === 1)
                        setMandatory((old) =>
                          old.filter((item) => item !== "models"),
                        );
                    }}
                    className="rounded-full bg-blue-500/20 px-3 py-1.5 text-[11px] text-blue-200"
                  >
                    {model} ×
                  </button>
                ))}
              </div>
              {required("models", selectedModels.length > 0)}
              {(
                [
                  "body_type",
                  "fuel_type",
                  "transmission",
                  "drivetrain",
                ] as Filter[]
              ).map((key) => (
                <div className="mt-5" key={key}>
                  <label className={label} htmlFor={`finder-${key}`}>
                    {FILTER_NAMES[key]}
                  </label>
                  <select
                    id={`finder-${key}`}
                    className={input}
                    value={filters[key] || ""}
                    onChange={(event) => choose(key, event.target.value)}
                  >
                    <option value="">No preference</option>
                    {OPTIONS[key].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                  {required(key, !!filters[key])}
                </div>
              ))}
              <div className="mt-5 grid grid-cols-2 gap-3">
                {(["min_year", "max_mileage"] as Filter[]).map((key) => (
                  <div key={key}>
                    <label className={label} htmlFor={`finder-${key}`}>
                      {FILTER_NAMES[key]}
                    </label>
                    <input
                      id={`finder-${key}`}
                      type="number"
                      min={key === "min_year" ? 1900 : 0}
                      max={key === "min_year" ? 2100 : 2000000}
                      step="1"
                      placeholder={
                        key === "min_year" ? "e.g. 2020" : "e.g. 60,000"
                      }
                      className={input}
                      value={filters[key] || ""}
                      onChange={(event) => choose(key, event.target.value)}
                    />
                    {required(key, !!filters[key])}
                  </div>
                ))}
              </div>
              <label className={`${label} mt-5`} htmlFor="finder-min-seats">
                Minimum listed seats
              </label>
              <input
                id="finder-min-seats"
                type="number"
                min="1"
                max="100"
                step="1"
                value={filters.min_seats || ""}
                onChange={(event) => choose("min_seats", event.target.value)}
                placeholder="e.g. 7"
                className={input}
              />
              {required("min_seats", !!filters.min_seats)}
              <label className={`${label} mt-5`} htmlFor="finder-location">
                Preferred NZ location
              </label>
              <input
                id="finder-location"
                list="finder-nz-locations"
                maxLength={100}
                className={input}
                value={filters.location || ""}
                onChange={(event) => choose("location", event.target.value)}
                placeholder="e.g. Auckland"
              />
              <datalist id="finder-nz-locations">
                {LOCATIONS.map((location) => (
                  <option key={location} value={location} />
                ))}
              </datalist>
              {required("location", !!filters.location)}
            </details>
            <details className="rounded-2xl border border-[#293d57] bg-[#102038] p-5 sm:p-6">
              <summary className="cursor-pointer text-sm font-semibold">
                04 / Fine-tune matching & exclusions
              </summary>
              <p className="mt-3 text-xs leading-6 text-slate-400">
                Importance changes ranking, never your hard limits. A weight
                only applies when that criterion is selected in your filters or
                interpreted text.
              </p>
              <label className={`${label} mt-5`} htmlFor="finder-sort">
                Ranking order for the next search
              </label>
              <select
                id="finder-sort"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className={input}
              >
                <option value="match">Best supported fit</option>
                <option value="price">Lowest asking price</option>
                <option value="newest">Newest model year</option>
                <option value="mileage">Lowest kilometres</option>
              </select>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {(
                  [
                    "budget",
                    "makes",
                    "models",
                    "body_type",
                    "min_year",
                    "max_mileage",
                    "fuel_type",
                    "transmission",
                    "drivetrain",
                    "location",
                    "min_seats",
                  ] as const
                ).map((key) => (
                  <label key={key} className={label}>
                    {key === "budget" ? "Budget" : FILTER_NAMES[key]} importance
                    <select
                      aria-label={`${key === "budget" ? "Budget" : FILTER_NAMES[key]} ranking importance`}
                      value={importance[key] ?? 2}
                      onChange={(event) =>
                        setImportance((old) => ({
                          ...old,
                          [key]: Number(event.target.value),
                        }))
                      }
                      className={`${input} mt-2 !py-2 !text-xs`}
                    >
                      <option value="1">Lower</option>
                      <option value="2">Normal</option>
                      <option value="3">Higher</option>
                    </select>
                  </label>
                ))}
              </div>
              <label htmlFor="finder-exclude-make" className={`${label} mt-5`}>
                Exclude manufacturers (hard rule)
              </label>
              <select
                id="finder-exclude-make"
                value=""
                disabled={excludedMakes.length >= 12}
                className={input}
                onChange={(event) => {
                  if (event.target.value)
                    setExcludedMakes((old) => [...old, event.target.value]);
                }}
              >
                <option value="">Add a manufacturer to exclude</option>
                {makes
                  .filter((make) => !excludedMakes.includes(make.name))
                  .map((make) => (
                    <option key={make.id}>{make.name}</option>
                  ))}
              </select>
              <div className="mt-2 flex flex-wrap gap-2">
                {excludedMakes.map((make) => (
                  <button
                    key={make}
                    type="button"
                    onClick={() => {
                      dirty();
                      setExcludedMakes((old) =>
                        old.filter((item) => item !== make),
                      );
                    }}
                    className="rounded-full bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200"
                    aria-label={`Stop excluding ${make}`}
                  >
                    {make} ×
                  </button>
                ))}
              </div>
              <p className={`${label} mt-5`}>Exclude fuel types (hard rule)</p>
              <div className="grid grid-cols-2 gap-3">
                {OPTIONS.fuel_type.map((fuel) => (
                  <label
                    key={fuel}
                    className="flex items-center gap-2 text-xs text-slate-300"
                  >
                    <input
                      type="checkbox"
                      className="accent-blue-500"
                      checked={excludedFuels.includes(fuel)}
                      onChange={(event) =>
                        setExcludedFuels((old) =>
                          event.target.checked
                            ? [...old, fuel]
                            : old.filter((item) => item !== fuel),
                        )
                      }
                    />
                    {fuel}
                  </label>
                ))}
              </div>
              <p className="mt-3 text-[10px] leading-5 text-slate-500">
                Unknown fuel entries are excluded too, since their fuel cannot
                be guaranteed. Preferred and excluded choices must not conflict.
              </p>
            </details>
            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm leading-6 text-red-200"
              >
                {error}
              </p>
            )}
            <button
              disabled={loading}
              className="flex min-h-14 w-full items-center justify-between rounded-xl bg-blue-600 px-6 py-4 text-sm font-bold shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 disabled:opacity-60"
              type="submit"
            >
              <span>
                {loading ? "Finding your matches…" : "Find my matches"}
              </span>
              <span aria-hidden="true">{loading ? "◌" : "↗"}</span>
            </button>
            <p className="text-center text-[10px] text-slate-500">
              No account needed. Only active, public REVV listings.
            </p>
          </fieldset>
        </form>
        <section
          ref={results}
          aria-labelledby="finder-results-heading"
          aria-busy={loading}
          className="scroll-mt-28"
        >
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold tracking-[.2em] text-blue-400">
                YOUR SHORTLIST
              </p>
              <h2
                id="finder-results-heading"
                className="mt-2 text-2xl font-semibold tracking-tight"
              >
                {result
                  ? "Your REVV matches"
                  : "Good choices start with a good fit."}
              </h2>
            </div>
            {result && (
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="text-slate-400">
                  {result.candidates_considered} eligible listings considered
                </span>
                <button
                  type="button"
                  onClick={() => scrollToFinderSection(form.current)}
                  className="min-h-10 font-semibold text-blue-300 hover:text-blue-200"
                >
                  Adjust preferences ↑
                </button>
              </div>
            )}
          </div>
          {loading && (
            <div
              role="status"
              className="mb-5 rounded-xl border border-blue-400/30 bg-blue-400/10 p-4 text-sm text-blue-200"
            >
              Checking active listings against your requirements…
            </div>
          )}
          {changed && (
            <p
              role="status"
              className="mb-5 rounded-xl bg-amber-400/10 p-4 text-xs text-amber-200"
            >
              Your preferences changed. Select “Find my matches” to update these
              results.
            </p>
          )}
          {!result ? (
            <div className="rounded-2xl border border-dashed border-[#31445f] bg-[#0d1c30] p-7 sm:p-10">
              <div
                className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500/10 text-2xl text-blue-400"
                aria-hidden="true"
              >
                ⌕
              </div>
              <h3 className="text-xl font-semibold">
                Less scrolling. Clearer trade-offs.
              </h3>
              <p className="mt-4 max-w-md text-sm leading-7 text-slate-400">
                Tell us what you’re looking for. Your shortlist will use the
                vehicles actually advertised on REVV, with their real asking
                prices and listing photos.
              </p>
              <div className="mt-8 grid gap-5 border-t border-white/10 pt-7 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-blue-200">
                    Hard limits stay hard
                  </p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    Budget and “Must have” filters control eligibility.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-200">
                    Every match has a reason
                  </p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">
                    See matches, compromises and missing evidence.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-5 rounded-xl border border-white/10 bg-[#0d1c30] p-4 text-xs leading-6 text-slate-400">
                <p className="font-semibold text-slate-200">
                  Within-budget limit:{" "}
                  {money(Number(result.preferences.max_budget))}
                </p>
                <p>
                  Fit scores describe known listing criteria, not vehicle
                  quality, reliability or a purchase recommendation.
                </p>
                {result.notes.map((note) => (
                  <p key={note} className="mt-2">
                    {note}
                  </p>
                ))}
                {Object.keys(result.interpreted).length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer font-semibold text-blue-300">
                      Review interpreted text preferences
                    </summary>
                    <dl className="mt-2 space-y-1">
                      {Object.entries(result.interpreted).map(
                        ([key, value]) => (
                          <div key={key}>
                            <dt className="inline font-semibold">
                              {(
                                {
                                  max_budget: "Maximum budget",
                                  makes: "Manufacturers",
                                  models: "Models",
                                  min_year: "Minimum year",
                                  max_mileage: "Maximum kilometres",
                                  priorities: "Priorities",
                                } as Record<string, string>
                              )[key] || key.replaceAll("_", " ")}
                              :{" "}
                            </dt>
                            <dd className="inline">
                              {Array.isArray(value)
                                ? value.join(", ")
                                : typeof value === "object" && value !== null
                                  ? Object.keys(value)
                                      .map(
                                        (name) =>
                                          PERSONAL.find(
                                            (item) => item.key === name,
                                          )?.label || name,
                                      )
                                      .join(", ")
                                  : String(value)}
                            </dd>
                          </div>
                        ),
                      )}
                    </dl>
                  </details>
                )}
              </div>
              {result.matches.length === 0 ? (
                <div
                  role="status"
                  className="rounded-2xl border border-[#293d57] bg-[#102038] p-8"
                >
                  <h3 className="text-lg font-semibold">
                    No matches within your hard limits.
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-slate-400">
                    {result.empty_message}
                  </p>
                  {(result.relaxation_options ?? []).length > 0 && (
                    <div className="mt-5 space-y-2">
                      <p className="text-xs text-slate-400">
                        Optional adjustments — nothing changes until you choose
                        one and search again:
                      </p>
                      {result.relaxation_options.map((option) => (
                        <button
                          key={option.field}
                          type="button"
                          className="block min-h-11 rounded-xl border border-blue-300/30 px-4 py-2 text-left text-xs font-semibold text-blue-200"
                          onClick={() => {
                            if (option.action === "near") setNear(true);
                            else if (option.action === "soften")
                              setMandatory((old) =>
                                old.filter((key) => key !== option.field),
                              );
                            dirty();
                            scrollToFinderSection(form.current);
                          }}
                        >
                          {option.label} ↗
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid items-start gap-5 xl:grid-cols-2">
                  {result.matches.map((match) => (
                    <RecommendationCard
                      key={match.vehicle.id}
                      match={match}
                      selected={compared.some(
                        (item) => item.vehicle.id === match.vehicle.id,
                      )}
                      compareDisabled={
                        compared.length >= 3 &&
                        !compared.some(
                          (item) => item.vehicle.id === match.vehicle.id,
                        )
                      }
                      onCompare={() => toggleCompare(match)}
                    />
                  ))}
                </div>
              )}
              {result.near_matches.length > 0 && (
                <section className="mt-9" aria-labelledby="near-match-heading">
                  <p className="text-[10px] font-bold tracking-[.2em] text-amber-300">
                    OPTIONAL / OVER BUDGET
                  </p>
                  <h3
                    id="near-match-heading"
                    className="mt-2 text-xl font-semibold"
                  >
                    Near matches, with a clear trade-off.
                  </h3>
                  <p className="mb-5 mt-3 text-xs leading-6 text-slate-400">
                    These exceed your maximum budget by up to 10%. All other
                    mandatory filters still apply.
                  </p>
                  <div className="grid items-start gap-5 xl:grid-cols-2">
                    {result.near_matches.map((match) => (
                      <RecommendationCard
                        key={match.vehicle.id}
                        match={match}
                        selected={compared.some(
                          (item) => item.vehicle.id === match.vehicle.id,
                        )}
                        compareDisabled={
                          compared.length >= 3 &&
                          !compared.some(
                            (item) => item.vehicle.id === match.vehicle.id,
                          )
                        }
                        onCompare={() => toggleCompare(match)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
          <p className="mt-7 max-w-2xl text-[11px] leading-6 text-slate-500">
            Listing information is supplied by sellers and isn’t independently
            verified by this tool. Check condition, specification and
            suitability yourself. Demonstration listings are clearly marked and
            are not for sale.
          </p>
        </section>
      </div>
      <VehicleComparison matches={compared} clear={() => setCompared([])} />
    </main>
  );
}
