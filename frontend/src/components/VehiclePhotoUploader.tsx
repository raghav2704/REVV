
"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  remainingSlots: number;
  disabled?: boolean;
};

type Preview = {
  file: File;
  url: string;
};

const MAX_SIZE = 5 * 1024 * 1024;

const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export default function VehiclePhotoUploader({
  files,
  onChange,
  remainingSlots,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const created = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    setPreviews(created);

    return () => {
      created.forEach((preview) => {
        URL.revokeObjectURL(preview.url);
      });
    };
  }, [files]);

  function addFiles(incoming: File[]) {
    if (disabled) return;

    setError("");

    const available = Math.max(0, remainingSlots - files.length);

    if (available === 0) {
      setError("Maximum photo limit reached.");
      return;
    }

    const accepted: File[] = [];
    const errors: string[] = [];

    for (const file of incoming) {
      if (!ALLOWED.includes(file.type)) {
        errors.push(`${file.name}: unsupported format`);
        continue;
      }

      if (file.size > MAX_SIZE) {
        errors.push(`${file.name}: exceeds 5 MB`);
        continue;
      }

      if (files.some(
        (existing) =>
          existing.name === file.name &&
          existing.size === file.size &&
          existing.lastModified === file.lastModified
      )) {
        errors.push(`${file.name}: already selected`);
        continue;
      }

      if (accepted.length >= available) {
        errors.push("Only 10 photos are allowed per vehicle");
        break;
      }

      accepted.push(file);
    }

    if (errors.length) {
      setError(errors.join(". "));
    }

    if (accepted.length) {
      onChange([...files, ...accepted]);
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    if (!disabled) {
      addFiles(Array.from(event.dataTransfer.files));
    }
  }

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;

    if (disabled || next < 0 || next >= files.length) return;

    const reordered = [...files];

    [reordered[index], reordered[next]] = [
      reordered[next],
      reordered[index],
    ];

    onChange(reordered);
  }

  function remove(index: number) {
    if (disabled) return;

    onChange(files.filter((_, current) => current !== index));
  }

  return (
    <div className="space-y-5">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setDragging(false);
          }
        }}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
          dragging
            ? "border-blue-400 bg-blue-500/15"
            : "border-white/20 bg-[#0b1424]"
        }`}
      >
        <div className="text-4xl" aria-hidden="true">
          📷
        </div>

        <h3 className="mt-4 text-xl font-bold text-white">
          Drag & Drop Vehicle Photos
        </h3>

        <p className="mt-2 text-sm text-slate-400">
          Or choose photos from your device
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={disabled || remainingSlots <= files.length}
          onChange={selectFiles}
          className="sr-only"
          aria-label="Choose vehicle photos"
        />

        <button
          type="button"
          disabled={disabled || remainingSlots <= files.length}
          onClick={() => inputRef.current?.click()}
          className="mt-5 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Browse Photos
        </button>

        <p className="mt-4 text-xs text-slate-500">
          JPG, PNG or WEBP · Maximum 5 MB per image
        </p>

        <p className="mt-2 text-xs text-blue-400">
          {files.length} selected ·{" "}
          {Math.max(0, remainingSlots - files.length)} spaces remaining
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {error}
        </p>
      )}

      {previews.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h4 className="font-semibold text-white">
              Selected Photos
            </h4>

            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange([])}
              className="text-sm text-red-300 hover:text-red-200 disabled:opacity-50"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {previews.map((preview, index) => (
              <div
                key={`${preview.file.name}-${preview.file.lastModified}-${index}`}
                className="overflow-hidden rounded-xl border border-white/10 bg-[#111c2e]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.url}
                  alt={`Selected vehicle photo ${index + 1}`}
                  className="aspect-[4/3] w-full object-cover"
                />

                <div className="space-y-2 p-3">
                  <p
                    className="truncate text-xs text-slate-300"
                    title={preview.file.name}
                  >
                    {preview.file.name}
                  </p>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={disabled || index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={`Move photo ${index + 1} left`}
                      className="flex-1 rounded-lg border border-white/15 p-2 text-xs text-white disabled:opacity-30"
                    >
                      ←
                    </button>

                    <button
                      type="button"
                      disabled={disabled || index === files.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={`Move photo ${index + 1} right`}
                      className="flex-1 rounded-lg border border-white/15 p-2 text-xs text-white disabled:opacity-30"
                    >
                      →
                    </button>

                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => remove(index)}
                      aria-label={`Remove photo ${index + 1}`}
                      className="flex-1 rounded-lg border border-red-500/30 p-2 text-xs text-red-300 disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
