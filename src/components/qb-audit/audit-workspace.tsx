"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-fetch";
import { SECTIONS } from "@/modules/qb-audit/criteria";
import type { evaluate } from "@/modules/qb-audit/engine";
import type { Assessment, Blueprint } from "@/modules/qb-audit/validation";
import { BlueprintEditor } from "./blueprint-editor";

type Evaluation = ReturnType<typeof evaluate>;
type Snapshot = { id: string; version: number; stale: boolean; status: "DRAFT" | "FINAL"; evaluatorName: string; createdAt: string; remarks: string; finalizedFromId: string | null; payload: Evaluation & { assessments: Assessment[]; blueprint: { version: number; data: Blueprint } | null; evaluator: { name: string; designation: string; departmentName?: string }; finalizer?: { name: string; finalizedAt: string } } };
type Workspace = { blueprints: { id: string; version: number; data: Blueprint }[]; snapshots: Snapshot[]; preview: Evaluation };
export function AuditWorkspace({ bankId }: { bankId: string }) {
  const [data, setData] = useState<Workspace | null>(null);
  const [selected, setSelected] = useState("");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const base = `/api/question-banks/${bankId}/audit`;
  const load = useCallback(async () => {
    const response = await apiFetch(base);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? "Could not load audit.");
    return body.data as Workspace;
  }, [base]);
  useEffect(() => { load().then(result => {
    setData(result);
    const latest = result.snapshots[0];
    if (latest) { setSelected(latest.id); setAssessments(latest.payload.assessments); setRemarks(latest.remarks); }
  }).catch(e => setError(e.message)); }, [load]);
  async function mutate(path: string, input: unknown) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await apiFetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.details?.map?.((i: { message: string }) => i.message).join("; ") || body.error?.message || "Could not save audit.");
      setData(await load());
      if (path !== "/blueprint") { setSelected(body.data.id); setDirty(false); }
      setMessage(path === "/finalize" ? "Final snapshot saved. It cannot be edited." : "New version saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Request failed."); }
    finally { setBusy(false); }
  }
  const snapshot = data?.snapshots.find(s => s.id === selected);
  const evaluation = snapshot?.payload ?? data?.preview;
  const readOnly = snapshot?.status === "FINAL";
  function select(id: string) {
    const row = data?.snapshots.find(s => s.id === id);
    setSelected(id); setAssessments(row?.payload.assessments ?? []); setRemarks(row?.remarks ?? ""); setDirty(false);
  }
  function edit(id: string, change: Partial<Assessment>) {
    setDirty(true);
    setAssessments(rows => {
      const current = rows.find(r => r.criterionId === id) ?? { criterionId: id, answer: "NO", evidence: "", reason: "" };
      return [...rows.filter(r => r.criterionId !== id), { ...current, ...change }];
    });
  }
  return <div className="space-y-6">
    <p>100 criteria · Yes = 10 · No = 0 · 1,000 total. Approved ≥900; minor corrections ≥750; otherwise revision required. Missing evidence is No.</p>
    <p>Audits remain available for locked or archived banks. Saving audit evidence or blueprint versions does not alter bank questions or workflow status.</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}{message && <p role="status">{message}</p>}
    {!data || !evaluation ? <p>Loading audit…</p> : <>
      <BlueprintEditor key={data.blueprints[0]?.id ?? "new"} initial={data.blueprints[0]?.data ?? null} busy={busy} onSave={v => mutate("/blueprint", v)} />
      <p>Current blueprint: {data.blueprints[0] ? `version ${data.blueprints[0].version}` : "missing"}. {data.blueprints.length} retained version(s).</p>
      <details><summary>Blueprint version history</summary>{data.blueprints.map(b => <details key={b.id}><summary>Version {b.version}</summary><pre className="overflow-auto text-xs">{JSON.stringify(b.data, null, 2)}</pre></details>)}</details>
      <label className="block">Audit version <select disabled={busy} className="rounded border p-2 bg-transparent" value={selected} onChange={e => select(e.target.value)}><option value="">Live source preview / new draft</option>{data.snapshots.map(s => <option key={s.id} value={s.id}>v{s.version} · {s.status}{s.stale ? " · STALE" : ""} · {s.evaluatorName} · {new Date(s.createdAt).toLocaleString()}</option>)}</select></label>
      {snapshot?.stale && <p role="alert" className="rounded border border-amber-500 p-3">This draft is stale: bank questions, assignments, approval records or the blueprint have changed. Review the current source and save a new draft before finalizing.</p>}
      <div className="rounded border p-4"><p className="text-xl font-semibold">{evaluation.score} / 1000 · {evaluation.decision.replaceAll("_", " ")}</p><p>{snapshot ? `Frozen ${snapshot.status.toLowerCase()} score` : "Live source preview"}{dirty ? " · Unsaved edits: save a draft to calculate the updated score." : ""}</p>
        {snapshot && <p>Evaluator: {snapshot.payload.evaluator.name} · {snapshot.payload.evaluator.designation} · {snapshot.payload.evaluator.departmentName} · Blueprint {snapshot.payload.blueprint?.version ?? "missing"}{snapshot.payload.finalizer ? ` · Finalized by ${snapshot.payload.finalizer.name} at ${snapshot.payload.finalizer.finalizedAt}` : ""}</p>}
      </div>
      {SECTIONS.map(section => <details key={section.id} className="rounded border p-4"><summary className="cursor-pointer font-semibold">{section.id}. {section.title} · {evaluation.sectionScores[section.id]} / 100</summary><div className="space-y-4 mt-4">{evaluation.results.filter(r => r.section === section.id).map(r => {
        const a = assessments.find(a => a.criterionId === r.id);
        const manual = r.source !== "RECORDS";
        return <article key={r.id} className="border-t pt-3 space-y-2"><h3 className="font-medium">{r.id} · {r.text}</h3><p>{r.answer} · {r.score}/10 · {r.reason}</p>
          <details><summary>Recorded evidence ({r.source.toLowerCase()})</summary><pre className="whitespace-pre-wrap break-words text-xs max-h-64 overflow-auto">{r.evidence || "No supporting evidence."}</pre></details>
          {manual && <fieldset disabled={busy || readOnly} className="space-y-2"><label className="block">Evaluator assessment <select className="border rounded p-1 bg-transparent" value={a?.answer ?? "NO"} onChange={e => edit(r.id, { answer: e.target.value as "YES" | "NO" })}><option value="NO">No</option><option value="YES">Yes — evidence required</option></select></label>
            <label className="block">Evidence reference and verified findings<textarea className="w-full border rounded p-2 bg-transparent" value={a?.evidence ?? ""} onChange={e => edit(r.id, { evidence: e.target.value })} maxLength={8000} /></label>
            <label className="block">Reason / observations<textarea className="w-full border rounded p-2 bg-transparent" value={a?.reason ?? ""} onChange={e => edit(r.id, { reason: e.target.value })} maxLength={4000} /></label>
          </fieldset>}
        </article>;
      })}</div></details>)}
      <label className="block">Evaluator remarks<textarea disabled={busy || readOnly} className="w-full border rounded p-3 bg-transparent" value={remarks} onChange={e => { setRemarks(e.target.value); setDirty(true); }} maxLength={16000} /></label>
      <p>Saving captures current bank records and the latest blueprint. Finalization checks that these sources are unchanged and saves an immutable final snapshot. Identity and date come from your authenticated session. Qualitative evidence is your signed-in review; approval criteria require actual approval records.</p>
      <div className="flex gap-3"><button disabled={busy || readOnly} className="rounded border px-4 py-2 disabled:opacity-50" onClick={() => mutate("", { remarks, assessments })}>Save new draft snapshot</button>
        <button disabled={busy || dirty || snapshot?.stale || snapshot?.status !== "DRAFT" || data.snapshots[0]?.id !== snapshot?.id} className="rounded border px-4 py-2 disabled:opacity-50" onClick={() => mutate("/finalize", { draftId: snapshot?.id })}>Finalize saved draft</button>
        {readOnly && <button className="rounded border px-4 py-2" onClick={() => { setSelected(""); setDirty(true); }}>Start new draft from these assessments</button>}
      </div>
    </>}
  </div>;
}
