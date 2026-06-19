import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const variantStyles = {
  default: {
    border: "border-[var(--border)]",
    hover: "hover:bg-[var(--surface-hover)]",
    accent: "text-[var(--accent)]",
  },
  success: {
    border: "border-green-500/30",
    hover: "hover:bg-green-50 dark:hover:bg-green-950/20",
    accent: "text-green-600 dark:text-green-400",
  },
  warning: {
    border: "border-amber-500/30",
    hover: "hover:bg-amber-50 dark:hover:bg-amber-950/20",
    accent: "text-amber-600 dark:text-amber-400",
  },
} as const;

interface PrimaryActionProps {
  title: string;
  description?: string;
  href: string;
  icon?: React.ReactNode;
  variant?: "default" | "success" | "warning";
  className?: string;
}

export function PrimaryAction({
  title,
  description,
  href,
  icon,
  variant = "default",
  className,
}: PrimaryActionProps) {
  const style = variantStyles[variant];
  const iconEl = icon ?? <ArrowRight className="h-4 w-4" />;

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border bg-[var(--card)] p-4 transition-colors",
        style.border,
        style.hover,
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-[var(--text-primary)]">{title}</p>
        {description && (
          <p className="mt-0.5 text-sm text-[var(--text-tertiary)]">{description}</p>
        )}
      </div>
      <Link href={href} className="shrink-0">
        <Button size="default" className="gap-1.5">
          {title}
          <span className={cn("transition-transform", style.accent)}>
            {iconEl}
          </span>
        </Button>
      </Link>
    </div>
  );
}

export type { PrimaryActionProps };
