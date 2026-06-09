"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center border-2 border-transparent px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] transition-all duration-100 focus-visible:outline focus-visible:outline-3 focus-visible:outline-[var(--foreground)] focus-visible:outline-offset-3 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[var(--foreground)] text-[var(--background)] hover:border-[var(--foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]",
        secondary: "border-[var(--foreground)] bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)]",
        outline: "border-[var(--foreground)] bg-transparent text-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-[var(--background)]",
        ghost: "bg-transparent px-0 text-[var(--foreground)] underline-offset-4 hover:underline",
      },
      size: {
        default: "",
        sm: "min-h-9 px-4 py-2 text-[11px]",
        lg: "min-h-12 px-8 py-4 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
));

Button.displayName = "Button";

export { Button, buttonVariants };
