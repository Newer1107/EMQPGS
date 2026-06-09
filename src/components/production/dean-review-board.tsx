"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-fetch";
import type { DeanReviewQueueItem } from "@/modules/production/service";

export function DeanReviewBoard({ banks }: { banks: DeanReviewQueueItem[] }) {
  const [status, setStatus] = useState("");
  const [busyBankId, setBusyBankId] = useState("");

  async function submitReview(questionBankId: string, formData: FormData) {
    setBusyBankId(questionBankId);
    setStatus("");

    const response = await apiFetch(`/api/question-banks/${questionBankId}/dean-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        regularPaperId: formData.get("regularPaperId"),
        supplementaryPaperId: formData.get("supplementaryPaperId"),
        ktPaperId: formData.get("ktPaperId"),
        notes: formData.get("notes"),
      }),
    });

    const result = await response.json();
    setBusyBankId("");
    setStatus(result.success ? "Dean selections saved." : result.error?.message ?? "Unable to save dean review");
    if (result.success) window.location.reload();
  }

  return (
    <div className="space-y-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">{status}</p>
      {banks.map((bank) => {
        const latestReport = bank.aiReports[0];
        const review = bank.deanReview as
          | {
              regularPaperId?: string;
              supplementaryPaperId?: string;
              ktPaperId?: string;
              notes?: string | null;
              selectedAt: Date | string;
              selectedBy: { name: string };
            }
          | null;
        return (
          <Card key={bank.id}>
            <CardHeader>
              <p className="page-kicker">Dean Review</p>
              <CardTitle className="mt-2 text-4xl">{bank.subject.subjectCode} · {bank.subject.subjectName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {bank.generatedPapers.map((paper) => (
                  (() => {
                    const scoredPaper = paper as typeof paper & {
                      coverageScore?: number | null;
                      difficultyScore?: number | null;
                      qualityScore?: number | null;
                      duplicateRisk?: number | null;
                      recommendation?: string | null;
                    };

                    return (
                      <div key={paper.id} className="border border-[var(--foreground)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-lg">{paper.variant.replaceAll("_", " ")}</h4>
                          <Badge>{paper.status}</Badge>
                        </div>
                        <div className="mt-4 space-y-2 text-sm">
                          <p>Coverage Score: {scoredPaper.coverageScore ?? "N/A"}</p>
                          <p>Difficulty Score: {scoredPaper.difficultyScore ?? "N/A"}</p>
                          <p>Quality Score: {scoredPaper.qualityScore ?? "N/A"}</p>
                          <p>Duplicate Risk: {scoredPaper.duplicateRisk ?? "N/A"}</p>
                          <p>Recommendation: {scoredPaper.recommendation ?? "Pending"}</p>
                        </div>
                      </div>
                    );
                  })()
                ))}
              </div>

              <div className="border border-[var(--border-light)] p-4 text-sm">
                <p>Latest AI Summary: {latestReport?.summary ?? "No AI report generated yet."}</p>
                {review ? (
                  <p className="mt-2">Last selected by {review.selectedBy.name} on {new Date(review.selectedAt).toLocaleString()}</p>
                ) : null}
              </div>

              <form className="grid gap-4 xl:grid-cols-4" action={async (formData) => submitReview(bank.id, formData)}>
                <PaperSelect name="regularPaperId" label="Regular Exam Paper" papers={bank.generatedPapers} defaultValue={review?.regularPaperId} />
                <PaperSelect name="supplementaryPaperId" label="Supplementary Paper" papers={bank.generatedPapers} defaultValue={review?.supplementaryPaperId} />
                <PaperSelect name="ktPaperId" label="KT Paper" papers={bank.generatedPapers} defaultValue={review?.ktPaperId} />
                <div className="space-y-2">
                  <Label htmlFor={`notes-${bank.id}`}>Notes</Label>
                  <Textarea id={`notes-${bank.id}`} name="notes" defaultValue={review?.notes ?? ""} />
                </div>
                <div className="xl:col-span-4">
                  <Button type="submit" disabled={busyBankId === bank.id}>Save Dean Selections</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PaperSelect({
  name,
  label,
  papers,
  defaultValue,
}: {
  name: string;
  label: string;
  papers: Array<{ id: string; variant: string }>;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Select id={name} name={name} defaultValue={defaultValue ?? papers[0]?.id ?? ""}>
        {papers.map((paper) => (
          <option key={`${name}-${paper.id}`} value={paper.id}>
            {paper.variant.replaceAll("_", " ")}
          </option>
        ))}
      </Select>
    </div>
  );
}
