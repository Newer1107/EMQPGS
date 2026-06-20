"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type ReviewRow = {
  subjectCode: string;
  subjectName: string;
  examCycleLabel: string;
  regularPaper: string;
  supplementaryPaper: string;
  ktPaper: string;
  reviewedAt: string;
};

export function DeanReportsCsvButton({ data }: { data: ReviewRow[] }) {
  function handleDownload() {
    const header = ["Subject", "Exam Cycle", "Regular Paper", "Supplementary Paper", "KT Paper", "Completed On"];
    const rows = data.map((r) => [
      `${r.subjectCode} · ${r.subjectName}`,
      r.examCycleLabel,
      r.regularPaper,
      r.supplementaryPaper,
      r.ktPaper,
      r.reviewedAt ? new Date(r.reviewedAt).toLocaleDateString() : "",
    ]);

    const csv = [header.join(","), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dean-review-reports-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (data.length === 0) return null;

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
      <Download className="mr-2 h-4 w-4" />
      Download CSV
    </Button>
  );
}
