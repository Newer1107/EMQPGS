"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/client-fetch";
import { difficultyLabels } from "@/lib/constants";
import { EntityStatusBanner } from "@/components/shared/entity-status-banner";

type PaperVariant = "PAPER_A" | "PAPER_B" | "PAPER_C";
type ExamType = "ISE_1" | "ISE_2" | "ENDSEM";

type EvaluationCategory = {
  label: string;
  earned: number;
  max: number;
  deductions: string[];
};

type EvaluationReport = {
  overall: number;
  categories: EvaluationCategory[];
  summary: string;
};

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
    evaluationReport: EvaluationReport | null;
    scoreBreakdown: string | null;
    hasGenerationTrace: boolean;
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

const EXAM_OPTIONS: Array<{ value: ExamType; label: string; modules: string }> = [
  { value: "ISE_1", label: "ISE-1", modules: "Modules 1\u20133" },
  { value: "ISE_2", label: "ISE-2", modules: "Modules 4\u20136" },
  { value: "ENDSEM", label: "END SEMESTER", modules: "Modules 1\u20136" },
];

function overallScoreColor(score: number): string {
  if (score >= 80) return "var(--success)";
  if (score >= 60) return "var(--warning)";
  return "var(--danger)";
}

export function DeanReviewWorkspace({ questionBankId, nextBankId }: { questionBankId: string; nextBankId?: string | null }) {
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expandedPaperIds, setExpandedPaperIds] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [selection, setSelection] = useState<{
    regularPaper: PaperVariant | "";
    supplementaryPaper: PaperVariant | "";
    ktPaper: PaperVariant | "";
  }>({
    regularPaper: "",
    supplementaryPaper: "",
    ktPaper: "",
  });

  // Exam generation state
  const [selectedExam, setSelectedExam] = useState<ExamType | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [showExamSelector, setShowExamSelector] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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

        // Auto-show exam selector when no papers exist
        if (!workspace.papers?.length) {
          setShowExamSelector(true);
        }

        // Pre-fill dean selection if review exists
        if (workspace.deanReview) {
          setSelection({
            regularPaper: workspace.deanReview.regularPaper,
            supplementaryPaper: workspace.deanReview.supplementaryPaper,
            ktPaper: workspace.deanReview.ktPaper,
          });
        }
      } catch (error) {
        console.error("[DeanReviewWorkspace]", error);
        if (active) {
          setError("Unable to reach the server. Please check your connection.");
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
  }, [questionBankId, refreshKey]);

  const selectionLocked = Boolean(data?.deanReview);
  const allSlotsAssigned = Boolean(selection.regularPaper && selection.supplementaryPaper && selection.ktPaper);
  const selectionsAreDistinct = new Set([selection.regularPaper, selection.supplementaryPaper, selection.ktPaper].filter(Boolean)).size === 3;
  const allPapersGenerated = (data?.papers?.length ?? 0) >= 3 && new Set(data?.papers?.map((p) => p.paperId) ?? []).size >= 3;
  const canSubmit = !selectionLocked && allSlotsAssigned && selectionsAreDistinct && !submitting;
  const hasPapers = (data?.papers?.length ?? 0) > 0;

  const disabledOptions = {
    regularPaper: new Set([selection.supplementaryPaper, selection.ktPaper].filter(Boolean)),
    supplementaryPaper: new Set([selection.regularPaper, selection.ktPaper].filter(Boolean)),
    ktPaper: new Set([selection.regularPaper, selection.supplementaryPaper].filter(Boolean)),
  };

  async function generatePapers() {
    if (!selectedExam) return;

    setGenerating(true);
    setGenerationError("");

    try {
      const response = await apiFetch(`/api/question-banks/${questionBankId}/papers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examType: selectedExam }),
      });

      const result = await response.json();

      if (!result.success) {
        setGenerationError(result.error?.message ?? "Failed to generate papers.");
        return;
      }

      // Refresh data from server and hide selector
      setShowExamSelector(false);
      setRefreshKey((k) => k + 1);
      router.refresh();
    } catch {
      setGenerationError("Unable to reach the server. Please check your connection.");
    } finally {
      setGenerating(false);
    }
  }

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

      setSubmitted(true);
      setMessage("Selection submitted successfully.");
    } catch (error) {
      console.error("[DeanReviewWorkspace]", error);
      setError("Unable to reach the server. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Card><CardContent className="py-10 text-sm text-[var(--text-tertiary)]">Loading review workspace...</CardContent></Card>;
  }

  if (!data) {
    return <Card><CardContent className="py-10 text-sm text-red-700">{error || "Review workspace unavailable."}</CardContent></Card>;
  }

  const shouldShowSelector = showExamSelector || !hasPapers;

  return (
    <div className="space-y-6">
      {shouldShowSelector ? (
        /* ── Exam type selection (pre-generation or change-exam) ── */
        <Card>
          <CardHeader>
            <CardTitle>{hasPapers ? "Regenerate Papers" : "Choose Examination"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              {EXAM_OPTIONS.map((exam) => (
                <label
                  key={exam.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-[var(--surface-hover)] ${
                    selectedExam === exam.value ? "border-[var(--foreground)]" : "border-[var(--border)]"
                  }`}
                >
                  <input
                    type="radio"
                    name="exam-type"
                    value={exam.value}
                    checked={selectedExam === exam.value}
                    onChange={() => setSelectedExam(exam.value)}
                    className="h-4 w-4 accent-[var(--foreground)]"
                  />
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{exam.label}</p>
                    <p className="text-sm text-[var(--text-tertiary)]">{exam.modules}</p>
                  </div>
                </label>
              ))}
            </div>

            {generationError ? <p className="text-sm text-red-700">{generationError}</p> : null}

            <div className="flex items-center gap-3">
              <Button onClick={generatePapers} disabled={!selectedExam || generating}>
                {generating ? "Generating papers..." : hasPapers ? "Regenerate Papers" : "Generate Papers"}
              </Button>
              {hasPapers ? (
                <Button variant="ghost" size="sm" onClick={() => setShowExamSelector(false)}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ── Post-generation: header + paper cards ── */
        <>
          <Card>
            <CardHeader>
              <CardTitle>{data.subjectCode} &middot; {data.subjectName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-[var(--text-tertiary)]">
              <p>{data.examCycleLabel}</p>
              <p>Generated {data.generationTimestamp ? new Date(data.generationTimestamp).toLocaleString() : "Unavailable"}</p>
              {data.deanReview ? (
                <p className="text-[var(--text-primary)]">
                  Selection locked on {new Date(data.deanReview.reviewedAt).toLocaleString()} by {data.deanReview.reviewedBy.name}.
                </p>
              ) : null}
              {message ? <p className="text-green-700">{message}</p> : null}
              {error ? <p className="text-red-700">{error}</p> : null}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setShowExamSelector(true)}>
              Change Exam
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowExamSelector(true)}>
              Regenerate Papers
            </Button>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {data.papers.map((paper) => {
              const groupedQuestions = groupQuestionsByModule(paper.questions);
              const duplicateRiskFlagged = (paper.duplicateRisk ?? 0) >= 20;
              const expanded = expandedPaperIds[paper.paperId] ?? false;
              const report = paper.evaluationReport;

              return (
                <Card key={paper.paperId} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>{paper.paperLabel}</CardTitle>
                      {duplicateRiskFlagged ? (
                        <Badge className="bg-red-700 text-white">Duplicate risk flagged</Badge>
                      ) : (
                        <Badge className="bg-white">Duplicate risk ok</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* ── Evaluation scores ── */}
                    {report ? (
                      <div className="space-y-4">
                        {/* Overall score bar */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-[var(--text-secondary)]">Overall Score</span>
                            <span
                              className="font-semibold tabular-nums"
                              style={{ color: overallScoreColor(report.overall) }}
                            >
                              {report.overall} / 100
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--text-tertiary)]">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, report.overall)}%`,
                                backgroundColor: overallScoreColor(report.overall),
                              }}
                            />
                          </div>
                        </div>

                        {/* Category scores */}
                        {report.categories.map((cat) => {
                          const pct = cat.max > 0 ? Math.min(100, Math.round((cat.earned / cat.max) * 100)) : 0;
                          return (
                            <div key={cat.label} className="group relative space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-[var(--text-secondary)]">{cat.label}</span>
                                <span className="font-medium tabular-nums">
                                  {cat.earned}/{cat.max}
                                </span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--text-tertiary)]">
                                <div
                                  className="h-full rounded-full bg-[var(--foreground)] transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              {cat.deductions.length > 0 ? (
                                <div className="absolute left-0 top-full z-10 mt-1 w-64 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-xs shadow-lg opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                                  <p className="mb-1 font-medium text-[var(--text-primary)]">Deductions</p>
                                  <ul className="space-y-0.5">
                                    {cat.deductions.map((d, i) => (
                                      <li key={i} className="flex items-start gap-1.5 text-[var(--text-secondary)]">
                                        <span className="mt-0.5 h-1 w-1 shrink-0 rounded-full bg-[var(--text-tertiary)]" />
                                        {d}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}

                        {/* Summary */}
                        <div className="rounded-xl border border-[var(--border)] p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Evaluation Summary</p>
                          <p className="mt-2 text-sm leading-6">{report.summary}</p>
                        </div>
                      </div>
                    ) : (
                      /* ── Legacy score fallback ── */
                      <>
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
                          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">AI Recommendation</p>
                          <p className="mt-2 text-sm leading-6">{paper.aiRecommendation}</p>
                        </div>
                      </>
                    )}

                    {/* Coverage & generation info */}
                    <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                      {paper.coverageScore != null ? <span>Coverage: {paper.coverageScore}%</span> : null}
                      {data.generationTimestamp ? (
                        <span>&middot; Generated: {new Date(data.generationTimestamp).toLocaleString()}</span>
                      ) : null}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/dean/question-banks/${questionBankId}/insights?variant=${paper.paperId}`}
                        className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        View Insights
                      </Link>
                      <a
                        href={`/api/question-banks/${questionBankId}/papers/${paper.paperId}/export`}
                        className="inline-flex items-center justify-center rounded-md bg-[var(--foreground)] px-3 py-2 text-xs font-medium text-[var(--background)] hover:opacity-90 transition-opacity"
                        download
                      >
                        Download DOCX
                      </a>
                    </div>

                    {/* Paper content expand */}
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
                            <div key={moduleNumber} className="rounded-lg bg-[var(--surface-hover)] p-3">
                              <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Module {moduleNumber}</p>
                              <div className="mt-3 space-y-3">
                                {questions.map((question, index) => (
                                  <div key={`${paper.paperId}-${moduleNumber}-${index}`} className="rounded-lg bg-white p-3 text-sm shadow-sm">
                                    <p className="leading-6">{question.questionText}</p>
                                    <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                                      {question.markType} marks &middot; {question.co} &middot; {question.rbtLevel} &middot;{" "}
                                      {question.difficultyLevel ? difficultyLabels[question.difficultyLevel] : "Unspecified"}
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

          {/* ── Dean selection interface ── */}
          <Card>
            <CardHeader>
              <CardTitle>{submitted ? "Selection Submitted" : selectionLocked ? "Submitted Selection" : "Selection Interface"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {submitted ? (
                <div className="space-y-4">
                  <p className="font-medium text-green-700">{message}</p>
                  {nextBankId ? (
                    <Button type="button" onClick={() => router.push(`/dashboard/dean/review?bank=${nextBankId}`)}>
                      Next Review &rarr;
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-[var(--text-tertiary)]">All reviews complete.</p>
                      <Button type="button" variant="outline" onClick={() => router.push("/dashboard/dean")}>
                        Return to Dashboard
                      </Button>
                    </div>
                  )}
                </div>
              ) : selectionLocked ? (
                <p className="text-sm text-[var(--text-tertiary)]">This review is read-only. Dean selections cannot be changed after submission.</p>
              ) : (
                <>
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

                  {allPapersGenerated ? (
                    <Button type="button" disabled={!canSubmit} onClick={submitSelection}>
                      {submitting ? "Submitting..." : "Submit Selection"}
                    </Button>
                  ) : (
                    <EntityStatusBanner
                      items={[
                        {
                          id: "papers-not-ready",
                          title: "Papers Not Generated",
                          description: "Papers are not yet generated. Please wait for paper generation to complete before reviewing.",
                          severity: "critical",
                        },
                      ]}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
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
      <td className="border-b border-[var(--border)] px-4 py-3 text-[var(--text-tertiary)]">{label}</td>
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
