"use client";

export default function RoleSectionError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm font-medium text-[var(--text-primary)]">
        COE dashboard unavailable
      </p>
      <p className="mt-1 text-xs text-[var(--text-tertiary)]">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={() => reset()}
        className="mt-4 text-sm font-medium underline underline-offset-4"
      >
        Try again
      </button>
    </div>
  );
}
