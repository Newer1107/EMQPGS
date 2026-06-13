"use client";

import { useEffect } from "react";

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Protected route error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center p-12">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-semibold mb-2">
          Something went wrong
        </h2>
        <p className="text-neutral-500 mb-6 leading-relaxed">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
