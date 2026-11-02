
"use client";

export type VehicleSpecifications = {
  variant: string | null;
  body_type: string | null;
  exterior_colour: string | null;
  seats: number | null;
  fuel_type: string | null;
  transmission: string | null;
  drivetrain: string | null;
  engine_cc: number | null;
  condition: string | null;
  vehicle_origin: string | null;
  description: string | null;
  wof_expiry: string | null;
  registration_expiry: string | null;
};

export const emptyVehicleSpecifications: VehicleSpecifications = {
  variant: null,
  body_type: null,
  exterior_colour: null,
  seats: null,
  fuel_type: null,
  transmission: null,
  drivetrain: null,
  engine_cc: null,
  condition: null,
  vehicle_origin: null,
  description: null,
  wof_expiry: null,
  registration_expiry: null,
};

type Props = {
  value: VehicleSpecifications;
  onChange: (next: VehicleSpecifications) => void;
  disabled?: boolean;
};

const BODY_TYPES = [
  "Sedan",
  "SUV",
  "Hatchback",
  "Wagon",
  "Coupe",
  "Convertible",
  "Ute",
  "Van",
  "People Mover",
  "Other",
];

const FUEL_TYPES = [
  "Petrol",
  "Diesel",
  "Hybrid",
  "Plug-in Hybrid",
  "Electric",
  "Other",
];

const TRANSMISSIONS = [
  "Automatic",
  "Manual",
  "CVT",
  "Other",
];

const DRIVETRAINS = [
  "FWD",
  "RWD",
  "AWD",
  "4WD",
  "Other",
];

const CONDITIONS = [
  "New",
  "Used",
  "Demonstrator",
];

const ORIGINS = [
  "NZ New",
  "Imported",
  "Unknown",
];

const fieldClass =
  "w-full min-h-12 rounded-xl border border-[#30415D] bg-[#111E32] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-400 hover:border-blue-400/50 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50";

const labelClass =
  "mb-2 block text-xs font-bold uppercase tracking-wider text-slate-300";

export default function VehicleSpecificationsFields({
  value,
  onChange,
  disabled = false,
}: Props) {
  function update<K extends keyof VehicleSpecifications>(
    key: K,
    nextValue: VehicleSpecifications[K]
  ) {
    onChange({
      ...value,
      [key]: nextValue,
    });
  }

  function updateText(
    key: keyof VehicleSpecifications,
    text: string
  ) {
    onChange({
      ...value,
      [key]: text === "" ? null : text,
    });
  }

  function updateNumber(
    key: "seats" | "engine_cc",
    text: string
  ) {
    const parsed = text === "" ? null : Number(text);

    update(
      key,
      parsed !== null && Number.isFinite(parsed)
        ? parsed
        : null
    );
  }

  function selectField(
    id: string,
    label: string,
    key: keyof VehicleSpecifications,
    options: string[]
  ) {
    return (
      <div>
        <label htmlFor={id} className={labelClass}>
          {label}
        </label>

        <select
          id={id}
          value={(value[key] as string | null) ?? ""}
          disabled={disabled}
          onChange={(event) =>
            updateText(key, event.target.value)
          }
          className={fieldClass}
        >
          <option value="">Not specified</option>

          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0E1A2C] text-white">
      <div className="border-b border-white/10 bg-[#132239] px-6 py-6 sm:px-8">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-400">
          REVV LISTING DETAILS
        </p>

        <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
          Vehicle specifications
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Help buyers understand your vehicle before they
          enquire. You can leave optional details blank.
        </p>
      </div>

      <div className="space-y-8 p-6 sm:p-8">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="spec-variant"
              className={labelClass}
            >
              Variant / Trim
            </label>

            <input
              id="spec-variant"
              type="text"
              maxLength={150}
              value={value.variant ?? ""}
              disabled={disabled}
              onChange={(event) =>
                updateText("variant", event.target.value)
              }
              placeholder="e.g. M Sport, AMG Line, RS"
              className={fieldClass}
            />
          </div>

          {selectField(
            "spec-body-type",
            "Body type",
            "body_type",
            BODY_TYPES
          )}

          {selectField(
            "spec-fuel-type",
            "Fuel type",
            "fuel_type",
            FUEL_TYPES
          )}

          {selectField(
            "spec-transmission",
            "Transmission",
            "transmission",
            TRANSMISSIONS
          )}

          {selectField(
            "spec-drivetrain",
            "Drivetrain",
            "drivetrain",
            DRIVETRAINS
          )}

          {selectField(
            "spec-condition",
            "Vehicle condition",
            "condition",
            CONDITIONS
          )}

          {selectField(
            "spec-origin",
            "Vehicle origin",
            "vehicle_origin",
            ORIGINS
          )}

          <div>
            <label
              htmlFor="spec-colour"
              className={labelClass}
            >
              Exterior colour
            </label>

            <input
              id="spec-colour"
              type="text"
              maxLength={50}
              value={value.exterior_colour ?? ""}
              disabled={disabled}
              onChange={(event) =>
                updateText(
                  "exterior_colour",
                  event.target.value
                )
              }
              placeholder="e.g. Alpine White"
              className={fieldClass}
            />
          </div>

          <div>
            <label
              htmlFor="spec-seats"
              className={labelClass}
            >
              Number of seats
            </label>

            <input
              id="spec-seats"
              type="number"
              min={1}
              max={100}
              step={1}
              value={value.seats ?? ""}
              disabled={disabled}
              onChange={(event) =>
                updateNumber("seats", event.target.value)
              }
              placeholder="e.g. 5"
              className={fieldClass}
            />
          </div>

          <div>
            <label
              htmlFor="spec-engine"
              className={labelClass}
            >
              Engine capacity (cc)
            </label>

            <input
              id="spec-engine"
              type="number"
              min={1}
              max={30000}
              step={1}
              value={value.engine_cc ?? ""}
              disabled={disabled}
              onChange={(event) =>
                updateNumber(
                  "engine_cc",
                  event.target.value
                )
              }
              placeholder="e.g. 1998"
              className={fieldClass}
            />
          </div>

          <div>
            <label
              htmlFor="spec-wof"
              className={labelClass}
            >
              WoF expiry
            </label>

            <input
              id="spec-wof"
              type="date"
              value={value.wof_expiry ?? ""}
              disabled={disabled}
              onChange={(event) =>
                updateText(
                  "wof_expiry",
                  event.target.value
                )
              }
              className={fieldClass}
            />
          </div>

          <div>
            <label
              htmlFor="spec-rego"
              className={labelClass}
            >
              Registration expiry
            </label>

            <input
              id="spec-rego"
              type="date"
              value={value.registration_expiry ?? ""}
              disabled={disabled}
              onChange={(event) =>
                updateText(
                  "registration_expiry",
                  event.target.value
                )
              }
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="spec-description"
            className={labelClass}
          >
            Vehicle description
          </label>

          <textarea
            id="spec-description"
            rows={6}
            maxLength={10000}
            value={value.description ?? ""}
            disabled={disabled}
            onChange={(event) =>
              updateText(
                "description",
                event.target.value
              )
            }
            placeholder="Tell buyers about the vehicle's features, service history, modifications and overall condition..."
            className={`${fieldClass} resize-y`}
          />

          <p className="mt-2 text-right text-xs text-slate-400">
            {(value.description ?? "").length.toLocaleString()}
            {" / 10,000 characters"}
          </p>
        </div>

        <div className="rounded-xl border border-blue-400/15 bg-blue-500/10 p-4">
          <p className="text-sm font-semibold text-blue-100">
            Better details. Better listings.
          </p>

          <p className="mt-1 text-xs leading-6 text-slate-300">
            These specifications help buyers compare
            vehicles accurately. Only enter information
            you can verify.
          </p>
        </div>
      </div>
    </section>
  );
}
