"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/client-fetch";
import { difficultyLabels } from "@/lib/constants";

type PaperVariant = "PAPER_A" | "PAPER_B" | "PAPER_C";

type WorkspaceData = {
  bankId: string;
  subjectName: string;
  subjectCode: string;
  examCycleLabel: string;
  generationTimestamp: string | null;
  papers: Array<{
    paperId: PaperVariant;
    paperLabel: string;
    coverageScore: number | null;
    difficultyScore: number | null;
    qualityScore: number | null;
    duplicateRisk: number | null;
    aiRecommendation: string;
    questions: Array<{
      questionText: string;
      markType: number;
      moduleNumber: number;
      co: string;
      rbtLevel: string;
      difficultyLevel: "EASY" | "MEDIUM" | "HARD" | null;
    }>;
  }>;
  deanReview: null | {
    id: string;
    regularPaper: PaperVariant;
    supplementaryPaper: PaperVariant;
    ktPaper: PaperVariant;
    reviewedAt: string;
    reviewedBy: {
      id: string;
      name: string;
      email: string;
    };
  };
};

export function DeanReviewWorkspace({ questionBankId }: { questionBankId: string }) {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expandedPaperIds, setExpandedPaperIds] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<{
    regularPaper: PaperVariant | "";
    supplementaryPaper: PaperVariant | "";
    ktPaper: PaperVariant | "";
  }>({
    regularPaper: "",
    supplementaryPaper: "",
    ktPaper: "",
  });

  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      setError("");

      try {
        const response = await apiFetch(`/api/question-banks/${questionBankId}/dean-review`);

        if (!active) return;

        if (!response.ok) {
          const body = await response.json().catch(() => ({ error: { message: "Unable to load dean review workspace." } }));
          setError(body.error?.message ?? "Unable to load dean review workspace.");
          setLoading(false);
          return;
        }

        const result = await response.json();

        if (!result.success) {
          setError(result.error?.message ?? "Unable to load dean review workspace.");
          setLoading(false);
          return;
        }

        const workspace = result.data as WorkspaceData;
        setData(workspace);
        if (workspace.deanReview) {
          setSelection({
            regularPaper: workspace.deanReview.regularPaper,
            supplementaryPaper: workspace.deanReview.supplementaryPaper,
            ktPaper: workspace.deanReview.ktPaper,
          });
        }
      } catch {
        if (active) {
          setError("Network request failed. Please check your connection.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, [questionBankId]);

  const selectionLocked = Boolean(data?.deanReview);
  const allSlotsAssigned = Boolean(selection.regularPaper && selection.supplementaryPaper && selection.ktPaper);
  const selectionsAreDistinct = new Set([selection.regularPaper, selection.supplementaryPaper, selection.ktPaper].filter(Boolean)).size === 3;
  const canSubmit = !selectionLocked && allSlotsAssigned && selectionsAreDistinct && !submitting;

  const disabledOptions = {
    regularPaper: new Set([selection.supplementaryPaper, selection.ktPaper].filter(Boolean)),
    supplementaryPaper: new Set([selection.regularPaper, selection.ktPaper].filter(Boolean)),
    ktPaper: new Set([selection.regularPaper, selection.supplementaryPaper].filter(Boolean)),
  };

  async function submitSelection() {
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(`/api/question-banks/${questionBankId}/dean-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regularPaper: selection.regularPaper,
          supplementaryPaper: selection.supplementaryPaper,
          ktPaper: selection.ktPaper,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error?.message ?? "Unable to submit dean selection.");
        return;
      }

      setMessage("Selection submitted successfully.");
      router.push("/dashboard/dean");
      router.refresh();
    } catch {
      setError("Network request failed. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Card><CardContent className="py-10 text-sm text-[var(--muted-foreground)]">Loading review workspace...</CardContent></Card>;
  }

  if (!data) {
    return <Card><CardContent className="py-10 text-sm text-red-700">{error || "Review workspace unavailable."}</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{data.subjectCode} · {data.subjectName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[var(--muted-foreground)]">
          <p>{data.examCycleLabel}</p>
          <p>Generated {data.generationTimestamp ? new Date(data.generationTimestamp).toLocaleString() : "Unavailable"}</p>
          {data.deanReview ? (
            <p className="text-[var(--foreground)]">
              Selection locked on {new Date(data.deanReview.reviewedAt).toLocaleString()} by {data.deanReview.reviewedBy.name}.
            </p>
          ) : null}
          {message ? <p className="text-green-700">{message}</p> : null}
          {error ? <p className="text-red-700">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        {data.papers.map((paper) => {
          const groupedQuestions = groupQuestionsByModule(paper.questions);
          const duplicateRiskFlagged = (paper.duplicateRisk ?? 0) >= 20;
          const expanded = expandedPaperIds[paper.paperId] ?? false;

          return (
            <Card key={paper.paperId} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{paper.paperLabel}</CardTitle>
                  {duplicateRiskFlagged ? <Badge className="bg-red-700 text-white">Duplicate risk flagged</Badge> : <Badge className="bg-white">Duplicate risk ok</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                  <table className="w-full text-sm">
                    <tbody>
                      <MetricRow label="Coverage Score" value={paper.coverageScore} />
                      <MetricRow label="Difficulty Score" value={paper.difficultyScore} />
                      <MetricRow label="Quality Score" value={paper.qualityScore} />
                      <MetricRow
                        label="Duplicate Risk"
                        value={paper.duplicateRisk}
                        suffix="%"
                        className={duplicateRiskFlagged ? "bg-red-50 text-red-700" : undefined}
                      />
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-[var(--border)] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">AI Recommendation</p>
                  <p className="mt-2 text-sm leading-6">{paper.aiRecommendation}</p>
                </div>

                <div className="rounded-xl border border-[var(--border)] p-4">
                  <button
                    type="button"
                    className="text-sm font-medium underline underline-offset-4"
                    onClick={() => setExpandedPaperIds((current) => ({ ...current, [paper.paperId]: !expanded }))}
                  >
                    {expanded ? "Collapse paper content" : "Expand paper content"}
                  </button>

                  {expanded ? (
                    <div className="mt-4 space-y-4">
                      {Object.entries(groupedQuestions).map(([moduleNumber, questions]) => (
                        <div key={moduleNumber} className="rounded-lg bg-[var(--muted)] p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Module {moduleNumber}</p>
                          <div className="mt-3 space-y-3">
                            {questions.map((question, index) => (
                              <div key={`${paper.paperId}-${moduleNumber}-${index}`} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                                <p className="leading-6">{question.questionText}</p>
                                <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                                  {question.markType} marks · {question.co} · {question.rbtLevel} · {question.difficultyLevel ? difficultyLabels[question.difficultyLevel] : "Unspecified"}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{selectionLocked ? "Submitted Selection" : "Selection Interface"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <SelectionField
              id="regular-paper"
              label="Regular Exam Paper"
              value={selection.regularPaper}
              options={data.papers.map((paper) => paper.paperId)}
              disabledOptions={disabledOptions.regularPaper}
              disabled={selectionLocked}
              onChange={(value) => setSelection((current) => ({ ...current, regularPaper: value as PaperVariant }))}
            />
            <SelectionField
              id="supplementary-paper"
              label="Supplementary Exam Paper"
              value={selection.supplementaryPaper}
              options={data.papers.map((paper) => paper.paperId)}
              disabledOptions={disabledOptions.supplementaryPaper}
              disabled={selectionLocked}
              onChange={(value) => setSelection((current) => ({ ...current, supplementaryPaper: value as PaperVariant }))}
            />
            <SelectionField
              id="kt-paper"
              label="KT (Keep Term) Paper"
              value={selection.ktPaper}
              options={data.papers.map((paper) => paper.paperId)}
              disabledOptions={disabledOptions.ktPaper}
              disabled={selectionLocked}
              onChange={(value) => setSelection((current) => ({ ...current, ktPaper: value as PaperVariant }))}
            />
          </div>

          {!selectionLocked ? (
            <Button type="button" disabled={!canSubmit} onClick={submitSelection}>
              {submitting ? "Submitting..." : "Submit Selection"}
            </Button>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">This review is read-only. Dean selections cannot be changed after submission.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SelectionField({
  id,
  label,
  value,
  options,
  disabledOptions,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  disabledOptions: Set<string>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select a paper</option>
        {options.map((option) => (
          <option key={`${id}-${option}`} value={option} disabled={value !== option && disabledOptions.has(option)}>
            {option}
          </option>
        ))}
      </Select>
    </div>
  );
}

function MetricRow({
  label,
  value,
  suffix = "",
  className,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  className?: string;
}) {
  return (
    <tr className={className}>
      <td className="border-b border-[var(--border)] px-4 py-3 text-[var(--muted-foreground)]">{label}</td>
      <td className="border-b border-[var(--border)] px-4 py-3 text-right font-semibold">{value == null ? "N/A" : `${value}${suffix}`}</td>
    </tr>
  );
}

function groupQuestionsByModule(questions: WorkspaceData["papers"][number]["questions"]) {
  return questions.reduce<Record<string, WorkspaceData["papers"][number]["questions"]>>((groups, question) => {
    const key = String(question.moduleNumber);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(question);
    return groups;
  }, {});
}
