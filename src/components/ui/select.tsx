import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-12 w-full border-0 border-b-2 border-[var(--foreground)] bg-transparent px-0 text-base text-[var(--foreground)] outline-none focus:border-b-[4px] focus:outline-none focus-visible:border-b-[4px]",
        className,
      )}
      {...props}
    />
  );
}
