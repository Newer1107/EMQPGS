import { cn } from "@/lib/utils";

export function Textarea({ className, error, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <div className="relative">
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-all duration-150 focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-[var(--danger)]",
          className,
        )}
        {...props}
      />
      {error && <p role="alert" className="mt-1 text-xs text-[var(--danger)]">{error}</p>}
    </div>
  );
}
