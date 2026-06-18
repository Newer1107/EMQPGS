import { cn } from "@/lib/utils";

export function Label({ className, required, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label className={cn("text-sm font-medium leading-none text-[var(--text-primary)]", className)} aria-required={required || undefined} {...props}>
      {children}
      {required && <span className="text-[var(--danger)] ml-0.5" aria-hidden="true">*</span>}
    </label>
  );
}
