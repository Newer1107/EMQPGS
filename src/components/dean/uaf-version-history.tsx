"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { apiFetch } from "@/lib/client-fetch";
import { cn } from "@/lib/utils";

// ── Types ───────────────────────────────────────────────────────

export interface VersionInfo {
  id: string;
  versionNumber: number;
  evaluationEngineVersion: string;
  evidenceHash: string | null;
  createdAt: string;
}

// ── Component ───────────────────────────────────────────────────

interface UafVersionHistoryProps {
  questionBankId: string;
  /** ID of the currently active version (highlighted). */
  currentVersionId?: string;
  /** Called when user clicks "Compare" on a version. */
  onCompare?: (versionId: string) => void;
  /** If true, show version selection for comparison mode. */
  selectionMode?: boolean;
  /** Currently selected version IDs (for comparison). */
  selectedIds?: string[];
  /** Called when a version checkbox/selection toggles. */
  onSelectionChange?: (selectedIds: string[]) => void;
  className?: string;
}

export function UafVersionHistory({
  questionBankId,
  currentVersionId,
  onCompare,
  selectionMode = false,
  selectedIds = [],
  onSelectionChange,
  className,
}: UafVersionHistoryProps) {
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await apiFetch(`/api/question-banks/${questionBankId}/analysis/versions`);
        if (!active) return;

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: { message: "Failed to load version history." } }));
          setError(body.error?.message ?? "Failed to load version history.");
          setLoading(false);
          return;
        }

        const result = await response.json();
        if (!result.success) {
          setError(result.error?.message ?? "Failed to load version history.");
          setLoading(false);
          return;
        }

        const data = (result.data ?? []) as VersionInfo[];

        // Deduplicate by id (safety check)
        const seen = new Set<string>();
        setVersions(data.filter((v) => {
          if (seen.has(v.id)) return false;
          seen.add(v.id);
          return true;
        }));
      } catch (err) {
        console.error("[UafVersionHistory]", err);
        if (active) setError("Unable to reach the server. Please check your connection.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [questionBankId]);

  function toggleSelection(id: string) {
    if (!onSelectionChange) return;
    const next = selectedIds.includes(id)
      ? selectedIds.filter((s) => s !== id)
      : [...selectedIds, id];
    onSelectionChange(next);
  }

  // ── Loading ──
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader><CardTitle>Version History</CardTitle></CardHeader>
        <CardContent>
          <LoadingSkeleton variant="table-row" count={4} />
        </CardContent>
      </Card>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <Card className={cn("border-red-500/30", className)}>
        <CardHeader><CardTitle>Version History</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border border-red-500/30 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Empty ──
  if (!versions.length) {
    return (
      <Card className={className}>
        <CardHeader><CardTitle>Version History</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--text-tertiary)]">No analysis versions found.</p>
        </CardContent>
      </Card>
    );
  }

  // ── Data ──
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Version History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-3 bottom-3 w-px bg-[var(--border-soft)]" />

          {versions.map((version, idx) => {
            const isFirst = idx === 0;
            const isCurrent = currentVersionId === version.id;
            const isSelected = selectedIds.includes(version.id);

            return (
              <div key={version.id} className="relative flex gap-4 pb-5 last:pb-0">
                {/* Timeline dot */}
                <div className="relative z-10 mt-1.5 flex shrink-0">
                  <div
                    className={cn(
                      "h-[15px] w-[15px] rounded-full border-2",
                      isCurrent
                        ? "border-[var(--foreground)] bg-[var(--foreground)]"
                        : isFirst
                          ? "border-blue-500 bg-blue-500"
                          : "border-[var(--border)] bg-[var(--background)]",
                    )}
                  />
                </div>

                {/* Content */}
                <div className={cn(
                  "min-w-0 flex-1 rounded-lg border p-3 transition-colors",
                  isCurrent
                    ? "border-[var(--foreground)] bg-[var(--surface-hover)]"
                    : "border-[var(--border)]",
                  isSelected && selectionMode ? "ring-2 ring-[var(--foreground)]" : "",
                )}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          Version {version.versionNumber}
                        </p>
                        {isCurrent ? (
                          <Badge variant="default" className="text-[10px]">Current</Badge>
                        ) : null}
                        {isFirst ? (
                          <Badge className="border-blue-500/30 bg-blue-50 text-blue-800 text-[10px] dark:bg-blue-950 dark:text-blue-300">Latest</Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                        {new Date(version.createdAt).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-[var(--text-tertiary)]">
                        Engine: {version.evaluationEngineVersion}
                        {version.evidenceHash ? <span className="ml-2 font-mono">Hash: {version.evidenceHash.slice(0, 12)}…</span> : null}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {selectionMode ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(version.id)}
                          className="h-4 w-4 accent-[var(--foreground)]"
                          aria-label={`Select version ${version.versionNumber} for comparison`}
                        />
                      ) : null}
                      {onCompare ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCompare(version.id)}
                        >
                          Compare
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
