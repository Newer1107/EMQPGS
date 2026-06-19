import { cn } from "@/lib/utils";

interface StatCardProps {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  trend?: { direction: "up" | "down"; value: string };
  variant?: "default" | "success" | "warning" | "info";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: { padding: "p-3", value: "text-lg", icon: "h-4 w-4" },
  md: { padding: "p-4", value: "text-2xl", icon: "h-5 w-5" },
  lg: { padding: "p-6", value: "text-3xl", icon: "h-6 w-6" },
} as const;

const variantBorder = {
  default: "",
  success: "border-l-green-500",
  warning: "border-l-amber-500",
  info: "border-l-blue-500",
} as const;

export function StatCard({
  value,
  label,
  icon,
  trend,
  variant = "default",
  size = "md",
  className,
}: StatCardProps) {
  const sz = sizeStyles[size];
  const border = variantBorder[variant];

  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border)] bg-[var(--card)]",
        sz.padding,
        border,
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className={cn("font-bold text-[var(--text-primary)]", sz.value)}>{value}</div>
          <div className="mt-0.5 text-xs font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
            {label}
          </div>
          {trend && (
            <div
              className={cn(
                "mt-1 text-xs",
                trend.direction === "up" ? "text-green-600" : "text-red-600",
              )}
            >
              {trend.direction === "up" ? "\u2191" : "\u2193"} {trend.value}
            </div>
          )}
        </div>
        {icon && <div className={cn("shrink-0 text-[var(--text-tertiary)]", sz.icon)}>{icon}</div>}
      </div>
    </div>
  );
}

export type { StatCardProps };
