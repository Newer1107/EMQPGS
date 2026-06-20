"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { feedback } from "@/lib/feedback";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FileText, Download, X } from "lucide-react";

type BankItem = {
  id: string;
  subject: { subjectCode: string; subjectName: string };
  aiReports: Array<{ status: string }>;
  generatedPapers: Array<{ id: string; variant: string }>;
  deanReview: { regularPaper: string; supplementaryPaper: string; ktPaper: string } | null;
};

export function ProductionTableClient({ banks }: { banks: BankItem[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === banks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(banks.map((b) => b.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedCount = selectedIds.size;

  return (
    <div className="relative">
      <Card>
        <CardHeader>
          <CardTitle>Generated Papers and Dean Selections</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === banks.length && banks.length > 0}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                  />
                </TH>
                <TH>Subject</TH>
                <TH>AI Report</TH>
                <TH>Papers</TH>
                <TH>Dean Selection</TH>
              </TR>
            </THead>
            <TBody>
              {banks.map((bank) => {
                const review = bank.deanReview;

                return (
                  <TR key={bank.id}>
                    <TD>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(bank.id)}
                        onChange={() => toggleId(bank.id)}
                        className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                      />
                    </TD>
                    <TD>{bank.subject.subjectCode} · {bank.subject.subjectName}</TD>
                    <TD>{bank.aiReports[0]?.status ?? "Not generated"}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-2">
                        {bank.generatedPapers.map((paper) => (
                          <Badge key={paper.id}>{paper.variant}</Badge>
                        ))}
                      </div>
                    </TD>
                    <TD>
                      {review ? (
                        <div className="space-y-1 text-sm">
                          <p>Regular: {review.regularPaper}</p>
                          <p>Supplementary: {review.supplementaryPaper}</p>
                          <p>KT: {review.ktPaper}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--text-tertiary)]">Pending dean review</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Floating action bar */}
      {selectedCount > 0 && (
        <div className="sticky bottom-6 mt-4 flex items-center justify-between rounded-lg border border-[var(--border)] bg-white px-4 py-3 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedCount} bank{selectedCount !== 1 ? "s" : ""} selected
            </span>
            <button
              onClick={clearSelection}
              className="flex items-center gap-1 text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="flex items-center gap-1.5" onClick={() => feedback.info(`AI Reports for ${selectedCount} bank${selectedCount !== 1 ? "s" : ""}`)}>
              <FileText className="h-4 w-4" />
              Generate AI Reports
            </Button>
            <Button size="sm" className="flex items-center gap-1.5" onClick={() => feedback.info(`Export initiated for ${selectedCount} bank${selectedCount !== 1 ? "s" : ""}`)}>
              <Download className="h-4 w-4" />
              Export Selected
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
