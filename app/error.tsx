"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          Something went wrong
        </h1>
        <p className="text-neutral-500 mb-6 leading-relaxed">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="rounded-lg bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-neutral-200 px-6 py-2.5 text-sm font-medium text-neutral-600 transition hover:bg-neutral-50"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
