"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { buildUafReport, isUafVersion, record, unwrapEnvelope, type UafReport } from "@/modules/uaf-export/report-model";
import { UafReportTable } from "./uaf-report-table";

interface Version { id: string; versionNumber: number }

export function UafComplianceReport({ questionBankId }: { questionBankId: string }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionId, setVersionId] = useState("");
  const [report, setReport] = useState<UafReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true); setError(""); setReport(null); setVersions([]); setVersionId("");
      try {
        const response = await apiFetch(`/api/question-banks/${questionBankId}/analysis/versions`);
        const data = unwrapEnvelope(await response.json());
        if (!response.ok || !Array.isArray(data)) throw new Error("Failed to load analysis versions.");
        const list = data.map(record).filter(v => isUafVersion(v) && typeof v.id === "string" && typeof v.versionNumber === "number") as unknown as Version[];
        list.sort((a, b) => b.versionNumber - a.versionNumber);
        if (!active) return;
        if (!list.length) throw new Error("No analysis data available.");
        setVersions(list); setVersionId(list[0].id);
      } catch (e) { if (active) { setError(e instanceof Error ? e.message : "Unable to load analysis."); setLoading(false); } }
    })();
    return () => { active = false; };
  }, [questionBankId]);
  useEffect(() => {
    if (!versionId) return;
    let active = true;
    void (async () => {
      setLoading(true); setError(""); setReport(null);
      try {
        const response = await apiFetch(`/api/question-banks/${questionBankId}/analysis/versions/${encodeURIComponent(versionId)}`);
        const data = unwrapEnvelope(await response.json());
        if (!response.ok || !record(data).id) throw new Error("Analysis version unavailable.");
        if (active) setReport(buildUafReport(data));
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Unable to load analysis."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [questionBankId, versionId]);

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <label className="text-sm">Report version{" "}
        <select aria-label="Report version" value={versionId} onChange={e => setVersionId(e.target.value)} className="rounded border bg-[var(--card)] p-2">
          {versions.map(v => <option key={v.id} value={v.id}>Version {v.versionNumber}</option>)}
        </select>
      </label>
      {report && !loading && <a className="rounded border px-3 py-2 text-sm font-medium" href={`/api/question-banks/${questionBankId}/analysis/export?versionId=${encodeURIComponent(report.versionId)}`} download>Download UAF PDF</a>}
    </div>
    {error && <p role="alert" className="rounded border border-red-400 p-4">{error}</p>}
    {loading && <LoadingSkeleton variant="card" className="h-96 w-full" />}
    {!loading && report && <>
      <p className="text-sm text-[var(--text-secondary)]">UAF v3.3 · Report version {report.versionNumber} · Engine {report.engineVersion}. Confidence measures evidence completeness; quality measures assessment performance.</p>
      <nav aria-label="UAF phases" className="flex flex-wrap gap-2 text-xs">
        {report.sections.map(section => <a className="rounded border px-2 py-1" key={section.number} href={`#uaf-phase-${section.number}`}>{section.number}. {section.title}</a>)}
      </nav>
      {report.sections.map(section => <section id={`uaf-phase-${section.number}`} key={section.number} className="scroll-mt-24 space-y-4">
        <h2 className="border-b pb-2 text-lg font-semibold">{section.number}. {section.title}</h2>
        <p className="text-sm">Confidence: {section.confidence}</p>
        {section.narrative && <p className="text-sm whitespace-pre-wrap">{section.narrative}</p>}
        {section.tables.map(table => <UafReportTable key={table.id} title={table.title} searchable exportable
          columns={table.headers.map((header, i) => ({ key: String(i), header, searchable: true, render: (row: Record<string, string>) => row[String(i)] }))}
          data={table.rows.map(row => Object.fromEntries(row.map((cell, i) => [String(i), cell])))} />)}
      </section>)}
    </>}
  </div>;
}
