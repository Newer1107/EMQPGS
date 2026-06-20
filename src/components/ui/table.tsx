"use client";

import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full text-sm", className)} {...props} />;
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("border-b border-[var(--border)] sticky top-0 z-10 bg-[var(--background)]", className)} {...props} />;
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("", className)} {...props} />;
}

export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b border-[var(--border-soft)] last:border-0", className)} {...props} />;
}

export function TH({ className, ...props }: React.ThHTMLAttributes<HTMLTableHeaderCellElement>) {
  return <th className={cn("px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)] sticky top-0 z-10 bg-[var(--background)]", className)} {...props} />;
}

export function TD({ className, ...props }: React.TdHTMLAttributes<HTMLTableDataCellElement>) {
  return <td className={cn("px-4 py-3 text-sm text-[var(--text-primary)]", className)} {...props} />;
}
