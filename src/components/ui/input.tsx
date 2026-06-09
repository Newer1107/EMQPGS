import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-12 w-full border-0 border-b-2 border-[var(--foreground)] bg-transparent px-0 py-2 text-base text-[var(--foreground)] outline-none placeholder:italic placeholder:text-[var(--muted-foreground)] focus:border-b-[4px] focus:outline-none focus-visible:border-b-[4px]",
        className,
      )}
      {...props}
    />
  );
}
