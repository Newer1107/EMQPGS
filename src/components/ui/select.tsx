import { cn } from "@/lib/utils";

export function Select({ className, error, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string }) {
  return (
    <div className="relative">
      <select
        className={cn(
          "flex h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-all duration-150 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-[var(--danger)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p role="alert" className="mt-1 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
