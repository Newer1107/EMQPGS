import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-[var(--border)] bg-[var(--surface-hover)] text-[var(--text-primary)]",
        success: "border-[var(--success-border)] bg-[var(--success-bg)] text-[var(--success)]",
        warning: "border-[var(--warning-border)] bg-[var(--warning-bg)] text-[var(--warning)]",
        danger: "border-[var(--danger-border)] bg-[var(--danger-bg)] text-[var(--danger)]",
        info: "border-[var(--info-border)] bg-[var(--info-bg)] text-[var(--info)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
