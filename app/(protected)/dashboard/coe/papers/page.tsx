"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { apiFetch } from "@/lib/client-fetch";
import { feedback } from "@/lib/feedback";
import { Download, CheckCircle2 } from "lucide-react";

type PaperVariant = "PAPER_A" | "PAPER_B" | "PAPER_C";

type PaperDeanReview = {
  regularPaper: string;
  supplementaryPaper: string;
  ktPaper: string;
  reviewedAt: string;
  reviewedBy: { id: string; name: string; email: string };
};

type Paper = {
  id: string;
  questionBankId: string;
  variant: PaperVariant;
  status: string;
  subjectCode: string;
  subjectName: string;
  semester: number;
  academicYear: string;
  overallScore: number | null;
  coverageScore: number | null;
  difficultyScore: number | null;
  generatedAt: string | null;
  deanReview: PaperDeanReview | null;
  questionCount: number;
};

const variantLabel: Record<PaperVariant, string> = {
  PAPER_A: "A",
  PAPER_B: "B",
  PAPER_C: "C",
};

function scoreColor(score: number | null): string {
  if (score == null) return "var(--text-tertiary)";
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

export default function CoePapersPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [markingPaper, setMarkingPaper] = useState<Paper | null>(null);
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadPapers() {
      setLoading(true);
      setError("");

      try {
        const response = await apiFetch("/api/coe/papers");

        if (!active) return;

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          setError(body.error?.message ?? "Unable to load papers.");
          setLoading(false);
          return;
        }

        const result = await response.json();

        if (!result.success) {
          setError(result.error?.message ?? "Unable to load papers.");
          setLoading(false);
          return;
        }

        setPapers(result.data ?? []);
      } catch {
        if (active) setError("Unable to reach the server. Please check your connection.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPapers();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  async function handleMarkUsed() {
    if (!markingPaper) return;

    setSubmitting(true);

    try {
      const response = await apiFetch(`/api/coe/papers/${markingPaper.id}/mark-used`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examDate: examDate || undefined }),
      });

      const result = await response.json();

      if (!result.success) {
        feedback.error(result.error?.message ?? "Failed to mark paper as used.");
        return;
      }

      feedback.success({
        title: "Paper marked as used",
        description: `${markingPaper.subjectCode} — ${variantLabel[markingPaper.variant]} variant. ${result.questionsMarked ?? 0} questions recorded.`,
      });

      setMarkingPaper(null);
      setRefreshKey((k) => k + 1);
    } catch {
      feedback.error("Unable to reach the server. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Paper Publication" description="Review dean-approved papers and manage publication." />
        <Card>
          <CardContent className="py-10 text-sm text-[var(--text-tertiary)]">Loading papers...</CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Paper Publication" description="Review dean-approved papers and manage publication." />
        <Card>
          <CardContent className="py-10 text-sm text-red-700">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Paper Publication" description="Review dean-approved papers and manage publication." />
        <Card>
          <CardContent className="py-10 text-sm text-[var(--text-tertiary)]">
            No papers found. Papers appear here after dean review.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paper Publication"
        description="Review dean-approved papers, download them, and mark them as used in examination."
      />

      <Card>
        <CardHeader>
          <CardTitle>Generated Papers</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Subject</TH>
                <TH>Variant</TH>
                <TH>Semester</TH>
                <TH>Academic Year</TH>
                <TH>Overall Score</TH>
                <TH>Dean Approval</TH>
                <TH>Generated At</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {papers.map((paper) => {
                const variant = variantLabel[paper.variant] ?? paper.variant;
                const score = paper.overallScore;
                const isApproved = paper.deanReview !== null;

                return (
                  <TR key={paper.id}>
                    <TD>
                      <div>
                        <p className="font-medium">{paper.subjectCode}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">{paper.subjectName}</p>
                      </div>
                    </TD>
                    <TD>
                      <Badge variant="default">{variant}</Badge>
                    </TD>
                    <TD className="tabular-nums">Sem {paper.semester}</TD>
                    <TD>{paper.academicYear}</TD>
                    <TD>
                      <span className="font-semibold tabular-nums" style={{ color: scoreColor(score) }}>
                        {score != null ? `${score}/100` : "N/A"}
                      </span>
                    </TD>
                    <TD>
                      <Badge variant={isApproved ? "success" : "warning"}>
                        {isApproved ? "Approved" : "Pending"}
                      </Badge>
                    </TD>
                    <TD className="text-xs text-[var(--text-tertiary)]">
                      {paper.generatedAt ? new Date(paper.generatedAt).toLocaleDateString() : "—"}
                    </TD>
                    <TD>
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/api/question-banks/${paper.questionBankId}/papers/${paper.variant}/export`}
                          className="inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
                          download
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </a>
                        <Button size="sm" variant="secondary" onClick={() => setMarkingPaper(paper)}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Mark Used
                        </Button>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mark As Used confirmation modal */}
      {markingPaper && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { if (!submitting) setMarkingPaper(null); }}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--background)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Mark Paper As Used</h2>

            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-lg bg-[var(--surface-hover)] p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Subject</span>
                  <span className="font-medium">{markingPaper.subjectCode} · {markingPaper.subjectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Variant</span>
                  <span className="font-medium">{variantLabel[markingPaper.variant]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Semester</span>
                  <span className="font-medium">Sem {markingPaper.semester}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Academic Year</span>
                  <span className="font-medium">{markingPaper.academicYear}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-tertiary)]">Questions</span>
                  <span className="font-medium">{markingPaper.questionCount}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="exam-date" className="text-sm font-medium text-[var(--text-primary)]">
                  Exam Date <span className="text-[var(--text-tertiary)]">(optional)</span>
                </label>
                <input
                  id="exam-date"
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="block w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
                />
              </div>

              <div className="rounded-lg border border-[var(--danger-border)] bg-[var(--danger-bg)] px-4 py-3">
                <p className="text-sm font-medium text-[var(--danger)]">This action is irreversible</p>
                <p className="mt-1 text-xs text-[var(--danger)] opacity-80">
                  Marking this paper as used will create question usage history records, preventing these questions
                  from being reused in future examinations.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setMarkingPaper(null)} disabled={submitting}>
                Cancel
              </Button>
              <Button variant="default" onClick={handleMarkUsed} loading={submitting}>
                {submitting ? "Marking..." : "Confirm — Mark As Used"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
