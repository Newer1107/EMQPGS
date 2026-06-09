import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]", className)} {...props} />;
}
