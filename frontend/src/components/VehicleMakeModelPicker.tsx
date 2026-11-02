
"use client";

import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  remainingSlots: number;
  disabled?: boolean;
};

type Preview = {
  key: string;
  url: string;
};

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export default function VehiclePhotoUploader({
  files,
  onChange,
  remainingSlots,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [previews, setPreviews] = useState<Preview[]>([]);

  const capacity = Math.max(0, remainingSlots);
  const slotsLeft = Math.max(0, capacity - files.length);
  const cannotAdd = disabled || slotsLeft === 0;

  useEffect(() => {
    const next = files.map((file) => ({
      key: fileKey(file),
      url: URL.createObjectURL(file),
    }));

    setPreviews(next);

    return () => {
      next.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [files]);

  function addFiles(incoming: File[]) {
    if (disabled) return;

    setError("");

    if (slotsLeft === 0) {
      setError("Maximum number of photos reached.");
      return;
    }

    const accepted: File[] = [];
    const errors: string[] = [];

    for (const file of incoming) {
      if (accepted.length >= slotsLeft) {
        errors.push("Some photos were skipped because the limit was reached.");
        break;
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: use JPG, PNG or WEBP.`);
        continue;
      }

      if (file.size > MAX_SIZE) {
        errors.push(`${file.name}: maximum file size is 5 MB.`);
        continue;
      }

      if (file.size === 0) {
        errors.push(`${file.name}: file is empty.`);
        continue;
      }

      const duplicate = [...files, ...accepted].some(
        (existing) => fileKey(existing) === fileKey(file)
      );

      if (duplicate) {
        errors.push(`${file.name}: already selected.`);
        continue;
      }

      accepted.push(file);
    }

    if (accepted.length > 0) {
      onChange([...files, ...accepted]);
    }

    if (errors.length > 0) {
      setError(errors.join(" "));
    }
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    if (cannotAdd) return;

    const dropped = Array.from(event.dataTransfer.files);

    if (dropped.length === 0) {
      setError("Drop image files from your computer.");
      return;
    }

    addFiles(dropped);
  }

  function removeFile(index: number) {
    if (disabled) return;

    onChange(files.filter((_, i) => i !== index));
    setError("");
  }

  function moveFile(index: number, direction: -1 | 1) {
    if (disabled) return;

    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= files.length) {
      return;
    }

    const next = [...files];

    [next[index], next[nextIndex]] = [
      next[nextIndex],
      next[index],
    ];

    onChange(next);
  }

  return (
    <div className="space-y-5 text-white">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={cannotAdd}
        onChange={handleInput}
        className="sr-only"
        aria-label="Select vehicle photos"
      />

      {/* DARK REVV DROP ZONE */}

      <div
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (!cannotAdd) {
            setIsDragging(true);
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (!cannotAdd) {
            event.dataTransfer.dropEffect = "copy";
            setIsDragging(true);
          } else {
            event.dataTransfer.dropEffect = "none";
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();

          if (
            !event.currentTarget.contains(
              event.relatedTarget as Node | null
            )
          ) {
            setIsDragging(false);
          }
        }}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-200 ${
          isDragging && !cannotAdd
            ? "border-blue-400 bg-blue-500/15 shadow-[inset_0_0_40px_rgba(37,99,235,0.10)]"
            : "border-blue-400/25 bg-[#111E32]"
        } ${cannotAdd ? "opacity-65" : ""}`}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-8 w-8 text-blue-400"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
        </div>

        <h3 className="mt-5 text-lg font-bold text-white">
          {isDragging && !cannotAdd
            ? "Drop your photos here"
            : "Drag and drop vehicle photos"}
        </h3>

        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-400">
          Showcase your vehicle with clear interior,
          exterior and detail shots.
        </p>

        <button
          type="button"
          disabled={cannotAdd}
          onClick={() => inputRef.current?.click()}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-600 px-6 text-sm font-bold text-white transition hover:bg-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Choose Photos
        </button>

        <p className="mt-4 text-xs text-slate-400">
          JPG, PNG or WEBP · Maximum 5 MB each
        </p>

        <div className="mt-6 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-blue-200">
          {files.length} of {capacity} available slots selected
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200"
        >
          {error}
        </div>
      )}

      {/* SELECTED PHOTO PREVIEWS */}

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-white">
              Selected photos
            </h4>

            <span className="text-xs text-slate-400">
              Use arrows to change photo order
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {files.map((file, index) => {
              const preview = previews[index];

              return (
                <div
                  key={`${fileKey(file)}-${index}`}
                  className="overflow-hidden rounded-xl border border-white/10 bg-[#132239]"
                >
                  <div className="relative aspect-square overflow-hidden bg-[#091321]">
                    {preview && preview.key === fileKey(file) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={preview.url}
                        alt={`Vehicle photo ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        Loading preview...
                      </div>
                    )}

                    {index === 0 && (
                      <span className="absolute left-2 top-2 rounded-lg bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white">
                        First photo
                      </span>
                    )}
                  </div>

                  <div className="p-3">
                    <p
                      title={file.name}
                      className="truncate text-xs text-slate-300"
                    >
                      {file.name}
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-1">
                      <button
                        type="button"
                        disabled={disabled || index === 0}
                        onClick={() => moveFile(index, -1)}
                        aria-label={`Move photo ${index + 1} left`}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white transition hover:bg-white/10 disabled:opacity-30"
                      >
                        ←
                      </button>

                      <button
                        type="button"
                        disabled={
                          disabled ||
                          index === files.length - 1
                        }
                        onClick={() => moveFile(index, 1)}
                        aria-label={`Move photo ${index + 1} right`}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white transition hover:bg-white/10 disabled:opacity-30"
                      >
                        →
                      </button>

                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => removeFile(index)}
                        aria-label={`Remove photo ${index + 1}`}
                        className="rounded-lg border border-red-400/20 bg-red-500/10 px-2.5 py-1.5 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-30"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
