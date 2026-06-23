"use client";

import { useState, useMemo, ReactNode } from "react";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Search, ArrowUpDown, Download } from "lucide-react";

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  searchable?: boolean;
  className?: string;
}

interface UafReportTableProps<T> {
  title: string;
  description?: string;
  formula?: string;
  confidence?: string;
  classification?: string;
  sourceData?: string;
  lastCalculated?: string;
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  searchable?: boolean;
  sortable?: boolean;
  exportable?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  maxRows?: number;
}

export function UafReportTable<T extends Record<string, unknown>>({
  title,
  description,
  formula,
  confidence,
  classification,
  sourceData,
  lastCalculated,
  columns,
  data,
  emptyMessage = "No data available.",
  searchable = false,
  sortable = false,
  exportable = false,
  collapsible = false,
  defaultCollapsed = false,
  maxRows,
}: UafReportTableProps<T>) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const processed = useMemo(() => {
    let rows = [...data];
    if (search && columns.some((c) => c.searchable)) {
      const q = search.toLowerCase();
      rows = rows.filter((r) =>
        columns.some((c) => {
          if (!c.searchable) return false;
          const val = c.render(r);
          return String(val ?? "").toLowerCase().includes(q);
        }),
      );
    }
    if (sortKey) {
      rows.sort((a, b) => {
        const aVal = String(a[sortKey] ?? "");
        const bVal = String(b[sortKey] ?? "");
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }
    if (maxRows) rows = rows.slice(0, maxRows);
    return rows;
  }, [data, search, sortKey, sortDir, columns, maxRows]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const exportCSV = () => {
    const headers = columns.map((c) => c.header).join(",");
    const rows = data.map((r) =>
      columns.map((c) => `"${String(c.render(r) ?? "").replace(/"/g, '""')}"`).join(","),
    );
    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/\s+/g, "_").toLowerCase()}.csv`;
    a.click();
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
            {classification && (
              <span className="inline-flex items-center rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
                {classification}
              </span>
            )}
          </div>
          {description && <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{description}</p>}
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-tertiary)]">
            {formula && <span>Formula: <code className="text-[var(--accent)]">{formula}</code></span>}
            {confidence && <span>Confidence: {confidence}</span>}
            {sourceData && <span>Source: {sourceData}</span>}
            {lastCalculated && <span>Updated: {lastCalculated}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {searchable && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                className="h-7 w-36 rounded-md border border-[var(--border)] bg-[var(--surface)] pl-6 pr-2 text-xs outline-none focus:border-[var(--accent)]"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          {exportable && (
            <button onClick={exportCSV} className="rounded-md p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]" title="Export CSV">
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          {collapsible && (
            <button onClick={() => setCollapsed(!collapsed)} className="rounded-md px-2 py-0.5 text-xs font-medium text-[var(--accent)] hover:bg-[var(--surface-hover)]">
              {collapsed ? "Show" : "Hide"}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <>
          {processed.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-[var(--text-tertiary)]">{emptyMessage}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    {columns.map((col) => (
                      <TH
                        key={col.key}
                        className={cn(
                          "whitespace-nowrap text-xs uppercase tracking-[0.06em]",
                          col.sortable && "cursor-pointer select-none hover:text-[var(--text-primary)]",
                          col.className,
                        )}
                        onClick={() => col.sortable && sortable && toggleSort(col.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.header}
                          {col.sortable && sortable && sortKey === col.key && (
                            <ArrowUpDown className={cn("h-3 w-3", sortDir === "desc" && "rotate-180")} />
                          )}
                        </span>
                      </TH>
                    ))}
                  </TR>
                </THead>
                <TBody>
                  {processed.map((row, i) => (
                    <TR key={i}>
                      {columns.map((col) => (
                        <TD key={col.key} className={cn("text-sm", col.className)}>
                          {col.render(row)}
                        </TD>
                      ))}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
          {maxRows && data.length > maxRows && (
            <div className="border-t border-[var(--border)] px-5 py-2 text-xs text-[var(--text-tertiary)]">
              Showing {Math.min(processed.length, maxRows)} of {data.length} rows
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Status / value renderers used across tables ──

export function MetricValue({ value, decimals = 2 }: { value: number | null | undefined; decimals?: number }) {
  if (value === null || value === undefined) return <span className="text-[var(--text-tertiary)] italic">Unable to Verify</span>;
  return <span className="font-mono tabular-nums">{(value * 100).toFixed(decimals)}%</span>;
}

export function ClassificationBadge({ classification }: { classification: string | null | undefined }) {
  if (!classification) return <span className="text-[var(--text-tertiary)] italic">N/A</span>;
  const colors: Record<string, string> = {
    EXEMPLARY: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    HIGHLY_EFFECTIVE: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
    EFFECTIVE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    ACCEPTABLE: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    NEEDS_IMPROVEMENT: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    MAJOR_REVISION_REQUIRED: "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[classification] ?? "bg-gray-100 text-gray-700"}`}>{classification.replace(/_/g, " ")}</span>;
}

export function VerificationStatus({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-[var(--text-tertiary)] italic">—</span>;
  const colors: Record<string, string> = {
    V: "text-green-600 dark:text-green-400",
    PV: "text-yellow-600 dark:text-yellow-400",
    UV: "text-red-600 dark:text-red-400",
    M: "text-gray-500 dark:text-gray-400",
  };
  const labels: Record<string, string> = {
    V: "Verified",
    PV: "Partially Verified",
    UV: "Unable to Verify",
    M: "Missing Data",
  };
  return <span className={`text-xs font-medium ${colors[status] ?? ""}`}>{labels[status] ?? status}</span>;
}

export function ConfidenceBadge({ score, classification }: { score: number | null | undefined; classification: string | null | undefined }) {
  if (score === null && !classification) return <span className="text-[var(--text-tertiary)] italic">N/A</span>;
  const colors: Record<string, string> = {
    VERY_HIGH: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    HIGH: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    LOW: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    VERY_LOW: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${classification ? (colors[classification] ?? "") : "bg-gray-100 text-gray-700"}`}>
      {classification && <span>{classification.replace(/_/g, " ")}</span>}
      {score != null && <span className="font-mono tabular-nums">({(score * 100).toFixed(0)}%)</span>}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string | null | undefined }) {
  if (!priority) return null;
  const colors: Record<string, string> = {
    CRITICAL: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    MAJOR: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    MODERATE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    MINOR: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${colors[priority] ?? ""}`}>{priority}</span>;
}
