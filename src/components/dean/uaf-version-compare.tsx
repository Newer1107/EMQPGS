"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { apiFetch } from "@/lib/client-fetch";
import { cn } from "@/lib/utils";
import { getIndexMeta, classificationStyle, formatClassification } from "./uaf-index-summary-table";

// ── Types ───────────────────────────────────────────────────────

export interface VersionRef {
  id: string;
  versionNumber: number;
  createdAt: string;
}

interface MetricDelta {
  indexCode: string;
  oldValue: number | null;
  newValue: number | null;
  delta: number | null;
  direction: "improved" | "declined" | "unchanged";
}

// ── Component ───────────────────────────────────────────────────

interface UafVersionCompareProps {
  questionBankId: string;
  versionA: VersionRef;
  versionB: VersionRef;
  onClose?: () => void;
  className?: string;
}

export function UafVersionCompare({
  questionBankId,
  versionA,
  versionB,
  onClose,
  className,
}: UafVersionCompareProps) {
  const [deltas, setDeltas] = useState<MetricDelta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await apiFetch(
          `/api/question-banks/${questionBankId}/analysis/compare?v1=${versionA.id}&v2=${versionB.id}`,
        );
        if (!active) return;

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: { message: "Failed to load comparison." } }));
          setError(body.error?.message ?? "Failed to load comparison.");
          setLoading(false);
          return;
        }

        const result = await response.json();
        if (!result.success) {
          setError(result.error?.message ?? "Failed to load comparison.");
          setLoading(false);
          return;
        }

        setDeltas((result.data?.deltas ?? []) as MetricDelta[]);
      } catch (err) {
        console.error("[UafVersionCompare]", err);
        if (active) setError("Unable to reach the server. Please check your connection.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [questionBankId, versionA.id, versionB.id]);

  // ── Loading ──
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Comparing v{versionA.versionNumber} vs v{versionB.versionNumber}</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton variant="table-row" count={6} />
        </CardContent>
      </Card>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <Card className={cn("border-red-500/30", className)}>
        <CardHeader><CardTitle>Version Comparison</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border border-red-500/30 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Empty ──
  if (!deltas.length) {
    return (
      <Card className={className}>
        <CardHeader><CardTitle>Version Comparison</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--text-tertiary)]">No comparable metrics found between these versions.</p>
        </CardContent>
      </Card>
    );
  }

  // ── Data ──
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Comparing v{versionA.versionNumber} vs v{versionB.versionNumber}</CardTitle>
          {onClose ? (
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          ) : null}
        </div>
        <div className="flex gap-4 text-xs text-[var(--text-tertiary)]">
          <span>v{versionA.versionNumber}: {new Date(versionA.createdAt).toLocaleDateString()}</span>
          <span>v{versionB.versionNumber}: {new Date(versionB.createdAt).toLocaleDateString()}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-xl border border-[var(--border)]">
          <Table>
            <THead>
              <TR>
                <TH>Index</TH>
                <TH className="text-center">v{versionA.versionNumber}</TH>
                <TH className="text-center">v{versionB.versionNumber}</TH>
                <TH className="text-center">Delta</TH>
                <TH className="text-center">Direction</TH>
              </TR>
            </THead>
            <TBody>
              {deltas.map((d) => {
                const meta = getIndexMeta(d.indexCode);
                const oldPct = d.oldValue !== null ? Math.round(d.oldValue * 100) : null;
                const newPct = d.newValue !== null ? Math.round(d.newValue * 100) : null;
                const deltaPct = d.delta !== null ? (d.delta * 100).toFixed(1) : null;

                // Classification styling for old/new values
                const oldStyle = d.oldValue !== null ? classificationStyle(classifyValue(d.oldValue)) : null;
                const newStyle = d.newValue !== null ? classificationStyle(classifyValue(d.newValue)) : null;

                const directionIcon = d.direction === "improved" ? "▲" : d.direction === "declined" ? "▼" : "—";
                const directionColor = d.direction === "improved" ? "text-green-700 dark:text-green-400"
                  : d.direction === "declined" ? "text-red-700 dark:text-red-400"
                  : "text-[var(--text-tertiary)]";

                return (
                  <TR key={d.indexCode}>
                    <TD>
                      <span className="font-medium">{meta.label}</span>
                      <span className="ml-2 text-[11px] text-[var(--text-tertiary)]">{d.indexCode}</span>
                    </TD>
                    <TD className={cn("text-center tabular-nums", oldStyle?.text)}>
                      {oldPct !== null ? `${oldPct}%` : "—"}
                    </TD>
                    <TD className={cn("text-center tabular-nums", newStyle?.text)}>
                      {newPct !== null ? `${newPct}%` : "—"}
                    </TD>
                    <TD className={cn("text-center tabular-nums font-medium", directionColor)}>
                      {deltaPct !== null ? `${deltaPct}pp` : "—"}
                    </TD>
                    <TD className={cn("text-center", directionColor)}>
                      <span className="flex items-center justify-center gap-1">
                        {d.direction !== "unchanged" ? (
                          <Badge className={cn(
                            "text-[10px]",
                            d.direction === "improved"
                              ? "border-green-700/30 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
                              : "border-red-500/30 bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-300",
                          )}>
                            {directionIcon} {d.direction}
                          </Badge>
                        ) : (
                          <span className="text-xs text-[var(--text-tertiary)]">{directionIcon}</span>
                        )}
                      </span>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>

        {/* Summary bar */}
        <div className="mt-4 flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green-600" />
            Improved: {deltas.filter((d) => d.direction === "improved").length}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-600" />
            Declined: {deltas.filter((d) => d.direction === "declined").length}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--border)]" />
            Unchanged: {deltas.filter((d) => d.direction === "unchanged").length}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Helper: infer classification from a raw value ───────────────
function classifyValue(value: number): string | null {
  if (value >= 0.9) return "EXEMPLARY";
  if (value >= 0.8) return "HIGHLY_EFFECTIVE";
  if (value >= 0.7) return "EFFECTIVE";
  if (value >= 0.6) return "ACCEPTABLE";
  if (value >= 0.5) return "NEEDS_IMPROVEMENT";
  return "MAJOR_REVISION_REQUIRED";
}
