import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full border-2 border-[var(--foreground)] bg-transparent px-4 py-3 text-base text-[var(--foreground)] outline-none placeholder:italic placeholder:text-[var(--muted-foreground)] focus:border-[4px] focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}
