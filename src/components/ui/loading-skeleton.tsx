import { cn } from "@/lib/utils";

interface LoadingSkeletonProps {
  variant: "card" | "table-row" | "text" | "avatar" | "stat";
  count?: number;
  className?: string;
}

function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded", className)} style={{ background: "var(--surface-hover)" }} />;
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <SkeletonLine className="h-5 w-2/5" />
      <SkeletonLine className="h-3 w-full" />
      <SkeletonLine className="h-3 w-11/12" />
      <SkeletonLine className="h-3 w-4/5" />
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex gap-4 py-3" style={{ borderBottom: "1px solid var(--border-soft)" }}>
      <SkeletonLine className="h-4 flex-1" />
      <SkeletonLine className="h-4 flex-1" />
      <SkeletonLine className="h-4 flex-1" />
      <SkeletonLine className="h-4 w-20" />
    </div>
  );
}

function TextSkeleton() {
  return <SkeletonLine className="h-4 w-3/5" />;
}

function AvatarSkeleton() {
  return <div className="animate-pulse rounded-full" style={{ width: 40, height: 40, background: "var(--surface-hover)" }} />;
}

function StatSkeleton() {
  return (
    <div className="space-y-2">
      <SkeletonLine className="h-3 w-16" />
      <SkeletonLine className="h-8 w-24" />
    </div>
  );
}

const variants: Record<string, React.FC> = {
  card: CardSkeleton,
  "table-row": TableRowSkeleton,
  text: TextSkeleton,
  avatar: AvatarSkeleton,
  stat: StatSkeleton,
};

export function LoadingSkeleton({ variant, count = 1, className }: LoadingSkeletonProps) {
  const Component = variants[variant];
  if (!Component) return null;

  return (
    <div className={cn("space-y-3", className)} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <Component key={i} />
      ))}
      <span className="sr-only">Loading...</span>
    </div>
  );
}
