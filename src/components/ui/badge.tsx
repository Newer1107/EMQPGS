import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("inline-flex border border-[var(--foreground)] bg-[var(--background)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--foreground)]", className)} {...props} />;
}
