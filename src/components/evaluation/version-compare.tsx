"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, AlertTriangle } from "lucide-react";

interface VersionRef {
  id: string;
  version: number;
  createdAt: string;
}

interface DeltaItem {
  moduleNumber: number;
  oldValue: number | null;
  newValue: number | null;
  delta: number | null;
  direction: "improved" | "declined" | "unchanged";
}

interface CompareResult {
  versionA: { overallAverage: number; verdict: string; findingsCount: number };
  versionB: { overallAverage: number; verdict: string; findingsCount: number };
  deltas: DeltaItem[];
  overallDelta: { oldValue: number; newValue: number; delta: number; direction: "improved" | "declined" | "unchanged" };
}

export function VersionCompare({ questionBankId, versions, onClose }: {
  questionBankId: string;
  versions: VersionRef[];
  onClose: () => void;
}) {
  const [v1, setV1] = useState(versions[1]?.id ?? versions[0]?.id ?? "");
  const [v2, setV2] = useState(versions[0]?.id ?? "");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!v1 || !v2) return;
    setLoading(true);
    setError(null);
    apiFetch(`/api/question-banks/${questionBankId}/evaluation/compare?v1=${v1}&v2=${v2}`)
      .then((r) => r.json())
      .then((body) => {
        if (body.deltas) setResult(body as CompareResult);
        else setError(body.error ?? "Comparison failed");
      })
      .catch(() => setError("Failed to load comparison"))
      .finally(() => setLoading(false));
  }, [questionBankId, v1, v2]);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Version Comparison</CardTitle>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">Close</button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <select className="h-9 flex-1 rounded-lg border border-[var(--border)] bg-white px-3 text-xs" value={v1} onChange={(e) => setV1(e.target.value)}>
            {versions.map((v) => <option key={v.id} value={v.id}>v{v.version} · {new Date(v.createdAt).toLocaleDateString()}</option>)}
          </select>
          <span className="text-xs text-[var(--text-tertiary)]">vs</span>
          <select className="h-9 flex-1 rounded-lg border border-[var(--border)] bg-white px-3 text-xs" value={v2} onChange={(e) => setV2(e.target.value)}>
            {versions.map((v) => <option key={v.id} value={v.id}>v{v.version} · {new Date(v.createdAt).toLocaleDateString()}</option>)}
          </select>
        </div>

        {loading && <p className="text-sm text-[var(--text-tertiary)] text-center py-4">Loading comparison…</p>}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4" /> {error}
          </div>
        )}

        {result && !loading && (
          <>
            {/* Summary comparison */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Score</p>
                <p className="text-lg font-bold">{(result.versionA.overallAverage * 100).toFixed(0)}%</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">v1</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Delta</p>
                <p className={`text-lg font-bold ${result.overallDelta.direction === "improved" ? "text-green-600" : result.overallDelta.direction === "declined" ? "text-red-600" : "text-[var(--text-tertiary)]"}`}>
                  {result.overallDelta.delta > 0 ? "+" : ""}{(result.overallDelta.delta * 100).toFixed(1)}%
                </p>
                {result.overallDelta.direction === "improved" ? <ArrowUp className="h-3 w-3 text-green-600 mx-auto" /> : result.overallDelta.direction === "declined" ? <ArrowDown className="h-3 w-3 text-red-600 mx-auto" /> : <Minus className="h-3 w-3 text-[var(--text-tertiary)] mx-auto" />}
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">Score</p>
                <p className="text-lg font-bold">{(result.versionB.overallAverage * 100).toFixed(0)}%</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">v2</p>
              </div>
            </div>

            {/* Verdict + Findings */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-[var(--text-tertiary)]">Verdict</p>
                <p className="font-medium">{result.versionA.verdict} → {result.versionB.verdict}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-[var(--text-tertiary)]">Findings</p>
                <p className="font-medium">{result.versionA.findingsCount} → {result.versionB.findingsCount}</p>
              </div>
            </div>

            {/* Per-module deltas */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
                    <th className="text-left py-2 pr-2">Module</th>
                    <th className="text-center py-2 pr-2">v1</th>
                    <th className="text-center py-2 pr-2">v2</th>
                    <th className="text-center py-2 pr-2">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {result.deltas.map((d) => (
                    <tr key={d.moduleNumber} className="border-b border-[var(--border)]/50">
                      <td className="py-2 pr-2 font-medium">Module {d.moduleNumber}</td>
                      <td className="py-2 pr-2 text-center">{(d.oldValue != null ? (d.oldValue * 100).toFixed(0) : "—")}%</td>
                      <td className="py-2 pr-2 text-center">{(d.newValue != null ? (d.newValue * 100).toFixed(0) : "—")}%</td>
                      <td className="py-2 pr-2 text-center">
                        {d.delta != null ? (
                          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${d.direction === "improved" ? "text-green-600" : d.direction === "declined" ? "text-red-600" : "text-[var(--text-tertiary)]"}`}>
                            {d.direction === "improved" ? <ArrowUp className="h-3 w-3" /> : d.direction === "declined" ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            {d.delta > 0 ? "+" : ""}{(d.delta * 100).toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
