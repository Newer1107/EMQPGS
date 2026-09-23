"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client-fetch";
import { AMI_CRITERIA, ATTRIBUTES, CAI_CRITERIA, FRI_CRITERIA, LABELS, QCQI_CRITERIA, SOURCE_TYPES } from "@/modules/uaf-review/criteria";
import { saveReviewSchema, type EvidenceSource, type ReviewEvidence } from "@/modules/uaf-review/validation";
import type { ReviewWorkspace } from "@/modules/uaf-review/service";

type Row = { key: string; value: string; evidence: EvidenceSource; disabled?: boolean };
const blankSource = (): EvidenceSource => ({ sourceType: "SYLLABUS", reference: "", rationale: "" });
const inputClass = "w-full rounded border p-2 bg-transparent text-sm";

export function initialReview(data: ReviewWorkspace): ReviewEvidence {
  return {
    schemaVersion: 1, bankFingerprint: data.bankFingerprint,
    questions: data.questions.map(question => data.latest?.evidence?.questions.find(review => review.questionId === question.id && review.questionVersion === question.questionVersion) ??
      { questionId: question.id, questionVersion: question.questionVersion, attributes: [], qcqi: [], cai: [] }),
    bankCriteria: data.bankEvidenceCurrent && data.latest?.evidence ? data.latest.evidence.bankCriteria : { AMI: [], FRI: [] },
  };
}

export function EvidenceTable({ title, rows, kind, onChange }: {
  title: string; rows: Row[]; kind: "accuracy" | "binary" | "score";
  onChange: (row: Row) => void;
}) {
  return <section className="space-y-2">
    <h3 className="font-semibold">{title}</h3>
    <div className="overflow-x-auto"><table className="w-full text-sm min-w-[850px]">
      <thead><tr className="text-left"><th className="p-2">Attribute / criterion</th><th className="p-2 w-36">Reviewed result</th><th className="p-2">Evidence source</th><th className="p-2">Reference / section / record ID</th><th className="p-2">Evidence and rationale</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.key} className="border-t align-top">
        <th scope="row" className="p-2 font-medium text-left">{LABELS[row.key] ?? row.key}{row.disabled && <p className="font-normal text-xs">Source metadata missing. Complete the question first.</p>}</th>
        <td className="p-2">{kind === "score" ?
          <input aria-label={`${title}: ${LABELS[row.key]} score`} className={inputClass} type="number" min={0} max={1} step="any" placeholder="Unreviewed" value={row.value} onChange={event => onChange({ ...row, value: event.target.value })} /> :
          <select aria-label={`${title}: ${LABELS[row.key]} result`} className={inputClass} disabled={row.disabled} value={row.value} onChange={event => onChange({ ...row, value: event.target.value })}>
            <option value="">Unreviewed</option><option value="1">{kind === "accuracy" ? "Correct" : "Satisfied"}</option><option value="0">{kind === "accuracy" ? "Incorrect" : "Not satisfied"}</option>
          </select>}</td>
        <td className="p-2"><select aria-label={`${title}: ${LABELS[row.key]} source type`} className={inputClass} disabled={row.disabled} value={row.evidence.sourceType} onChange={event => onChange({ ...row, evidence: { ...row.evidence, sourceType: event.target.value as EvidenceSource["sourceType"] } })}>
          {SOURCE_TYPES.map(type => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
        </select></td>
        <td className="p-2"><input aria-label={`${title}: ${LABELS[row.key]} source reference`} className={inputClass} disabled={row.disabled} maxLength={1000} value={row.evidence.reference} placeholder="e.g. Approved syllabus §3, CO2" onChange={event => onChange({ ...row, evidence: { ...row.evidence, reference: event.target.value } })} /></td>
        <td className="p-2"><textarea aria-label={`${title}: ${LABELS[row.key]} rationale`} className={inputClass} disabled={row.disabled} maxLength={4000} value={row.evidence.rationale} placeholder="What did you verify in this source?" onChange={event => onChange({ ...row, evidence: { ...row.evidence, rationale: event.target.value } })} /></td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}

export function UafReviewWorkspace({ initial }: { initial: ReviewWorkspace }) {
  const [data, setData] = useState(initial);
  const [draft, setDraft] = useState(() => initialReview(initial));
  // Preserve evidence typed before choosing a result, without sending unreviewed values.
  const [sources, setSources] = useState<Record<string, EvidenceSource>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const base = `/api/question-banks/${data.bank.id}/uaf-review`;

  function updateQuestion(id: string, group: "attributes" | "qcqi" | "cai" | "consistency", row: Row) {
    setSources(previous => ({ ...previous, [`${id}:${group}:${row.key}`]: row.evidence }));
    setDraft(previous => ({ ...previous, questions: previous.questions.map(question => {
      if (question.questionId !== id) return question;
      if (group === "consistency") return { ...question, metadataConsistency: row.value === "" ? undefined : { score: Number(row.value) as 0 | 1, evidence: row.evidence } };
      if (group === "attributes") return { ...question, attributes: [
        ...question.attributes.filter(item => item.attribute !== row.key),
        ...(row.value === "" ? [] : [{ attribute: row.key as typeof ATTRIBUTES[number], accurate: row.value === "1", evidence: row.evidence }]),
      ] };
      if (group === "qcqi") return { ...question, qcqi: [
        ...question.qcqi.filter(item => item.criterion !== row.key),
        ...(row.value === "" ? [] : [{ criterion: row.key as typeof QCQI_CRITERIA[number], score: Number(row.value), evidence: row.evidence }]),
      ] };
      return { ...question, cai: [
        ...question.cai.filter(item => item.criterion !== row.key),
        ...(row.value === "" ? [] : [{ criterion: row.key as typeof CAI_CRITERIA[number], satisfied: row.value === "1", evidence: row.evidence }]),
      ] };
    }) }));
    setMessage("");
  }

  function updateBank(code: "AMI" | "FRI", row: Row) {
    setSources(previous => ({ ...previous, [`${code}:${row.key}`]: row.evidence }));
    setDraft(previous => ({ ...previous, bankCriteria: {
      ...previous.bankCriteria,
      [code]: [...previous.bankCriteria[code].filter(item => item.criterion !== row.key),
        ...(row.value === "" ? [] : [{ criterion: row.key, score: Number(row.value), evidence: row.evidence }])],
    } }));
    setMessage("");
  }

  async function save() {
    setError(""); setMessage("");
    const parsed = saveReviewSchema.safeParse({ baseVersion: data.latest?.version ?? 0, evidence: draft });
    if (!parsed.success) {
      setError(parsed.error.issues.map(issue => `${issue.path.join(".")}: ${issue.message}`).join("; "));
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Unable to save review.");
      // Advance the optimistic version immediately so a failed refresh cannot cause duplicate saves.
      setData(previous => ({ ...previous, latest: { ...body.data, reviewerName: "You", evidence: parsed.data.evidence } }));
      setMessage(`Review version ${body.data.version} saved. Run a new analysis to use this evidence.`);
      const refreshed = await apiFetch(base);
      if (!refreshed.ok) throw new Error("Review saved, but refreshing failed. Reload this page before editing again.");
      const next = (await refreshed.json()).data as ReviewWorkspace;
      setData(next); setDraft(initialReview(next)); setSources({});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save review."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <p className="text-sm">Record your academic review against the displayed question version. Every result, including zero or incorrect, needs a source reference and rationale. Blank means unreviewed. Partial reviews may be saved; QCQI and CAI remain unavailable until all current questions are fully reviewed.</p>
    <p className="text-sm">QCQI uses seven 0–1 scores per question. CAI counts a question as aligned only when all four alignment criteria are satisfied. AMI and FRI each require all seven bank criteria. Saving creates an immutable version attributed to your signed-in account.</p>
    {data.latest && <p className="text-sm">Latest: version {data.latest.version} · {data.latest.reviewerName} · {new Date(data.latest.createdAt).toLocaleString()}</p>}
    {data.staleQuestionIds.length > 0 && <p role="status" className="rounded border border-amber-500 p-3">{data.staleQuestionIds.length} saved question reviews are stale or refer to removed questions. Affected entries were cleared; review the current questions below.</p>}
    {data.latest && !data.bankEvidenceCurrent && <p className="rounded border border-amber-500 p-3">Bank composition or source data changed. AMI/FRI criteria were cleared and must be reviewed again.</p>}
    {error && <p role="alert" className="text-red-700 whitespace-pre-wrap">{error}</p>}
    {message && <p role="status" className="text-green-700">{message}</p>}
    <fieldset disabled={busy} className="space-y-6">
      {data.questions.length === 0 && <p>No assigned questions. Add questions before reviewing their academic evidence.</p>}
      {data.questions.map(question => {
        const review = draft.questions.find(item => item.questionId === question.id)!;
        const valueFor = (attribute: string) => attribute === "questionId" ? question.id : question[attribute as keyof typeof question];
        return <details key={question.id} className="rounded border p-4">
          <summary className="cursor-pointer font-semibold">Module {question.moduleNumber} · {question.marks} marks · {question.id} · QCQI {review.qcqi.length}/7 · CAI {review.cai.length}/4</summary>
          <div className="space-y-5 mt-4">
            <p className="whitespace-pre-wrap">{question.questionText}</p>
            <dl className="grid gap-2 sm:grid-cols-3 text-sm">{ATTRIBUTES.map(attribute => <div key={attribute}><dt className="font-medium">{LABELS[attribute]}</dt><dd className="break-words">{Array.isArray(valueFor(attribute)) ? (valueFor(attribute) as string[]).join(", ") || "Missing" : String(valueFor(attribute) ?? "Missing")}</dd></div>)}</dl>
            <EvidenceTable title="Verified attribute accuracy" kind="accuracy" rows={ATTRIBUTES.map(key => {
              const item = review.attributes.find(item => item.attribute === key);
              const value = valueFor(key);
              return { key, value: item ? (item.accurate ? "1" : "0") : "", evidence: sources[`${question.id}:attributes:${key}`] ?? item?.evidence ?? blankSource(), disabled: value == null || value === "" || (Array.isArray(value) && value.length === 0) };
            })} onChange={row => updateQuestion(question.id, "attributes", row)} />
            <EvidenceTable title="QCQI quality scores (0–1)" kind="score" rows={QCQI_CRITERIA.map(key => {
              const item = review.qcqi.find(item => item.criterion === key);
              return { key, value: item ? String(item.score) : "", evidence: sources[`${question.id}:qcqi:${key}`] ?? item?.evidence ?? blankSource() };
            })} onChange={row => updateQuestion(question.id, "qcqi", row)} />
            <EvidenceTable title="CAI constructive alignment" kind="binary" rows={CAI_CRITERIA.map(key => {
              const item = review.cai.find(item => item.criterion === key);
              return { key, value: item ? (item.satisfied ? "1" : "0") : "", evidence: sources[`${question.id}:cai:${key}`] ?? item?.evidence ?? blankSource() };
            })} onChange={row => updateQuestion(question.id, "cai", row)} />
            <EvidenceTable title="Metadata consistency (MCS)" kind="binary" rows={[{ key: "consistency", value: review.metadataConsistency ? String(review.metadataConsistency.score) : "", evidence: sources[`${question.id}:consistency:consistency`] ?? review.metadataConsistency?.evidence ?? blankSource() }]}
              onChange={row => updateQuestion(question.id, "consistency", row)} />
          </div>
        </details>;
      })}
      {(["AMI", "FRI"] as const).map(code => <EvidenceTable key={code} title={code === "AMI" ? "AMI academic moderation — bank criteria" : "FRI future readiness — bank criteria"} kind="binary"
        rows={(code === "AMI" ? AMI_CRITERIA : FRI_CRITERIA).map(key => {
          const item = draft.bankCriteria[code].find(item => item.criterion === key);
          return { key, value: item ? String(item.score) : "", evidence: sources[`${code}:${key}`] ?? item?.evidence ?? blankSource() };
        })} onChange={row => updateBank(code, row)} />)}
      <button type="button" className="rounded border bg-blue-700 px-4 py-2 text-white disabled:opacity-50" onClick={save}>{busy ? "Saving…" : "Save new review version"}</button>
    </fieldset>
    <details className="rounded border p-4"><summary>Saved review history (latest 20)</summary>
      {data.history.length === 0 ? <p>No saved reviews.</p> : <ul className="mt-3 space-y-2 text-sm">{data.history.map(review => <li key={review.id}>Version {review.version} · {review.reviewerName} · {new Date(review.createdAt).toLocaleString()}</li>)}</ul>}
    </details>
  </div>;
}
