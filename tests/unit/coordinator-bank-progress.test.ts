import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoordinatorBankComparison, CoordinatorBankEvidenceLinks, ModuleCompletionSummary, moduleCompletion } from "@/components/dashboard/coordinator-bank-progress";

describe("coordinator module completion", () => {
  const slots = ["APPROVED", "REVISION_REQUESTED", "REVISION_SUBMITTED", "DRAFT", "REJECTED", null].map(status => ({ moduleNumber: 1, assignedQuestion: status ? { status } : null }));
  it("counts filled, approved, empty and both revision states without treating rejection as revision", () => {
    expect(moduleCompletion(slots, [1, 2], 7)).toEqual([
      { moduleNumber: 1, total: 7, filled: 5, approved: 1, empty: 2, revisions: 2 },
      { moduleNumber: 2, total: 7, filled: 0, approved: 0, empty: 7, revisions: 0 },
    ]);
  });
  it("preserves actual extra modules/slots and sorts module numbers numerically", () => {
    expect(moduleCompletion([...slots, { moduleNumber: 10, assignedQuestion: null }], [10, 2, 1], 2).map(r => [r.moduleNumber, r.total, r.empty])).toEqual([[1, 6, 1], [2, 2, 2], [10, 2, 2]]);
  });
  it("renders all completion counts and explains overlap", () => {
    const html = renderToStaticMarkup(createElement(ModuleCompletionSummary, { slots, modules: [1, 2], expectedPerModule: 7 }));
    expect(html).toContain("5/7 filled · 1 approved · 2 empty · 2 revisions");
    expect(html).toContain("0/7 filled · 0 approved · 7 empty · 0 revisions");
    expect(html).toContain("subsets of filled slots");
  });
});

describe("coordinator comparison and evidence navigation", () => {
  it("links the confirmed audit and academic review routes", () => {
    const html = renderToStaticMarkup(createElement(CoordinatorBankEvidenceLinks, { bankId: "bank-a" }));
    expect(html).toContain('href="/dashboard/coordinator/question-banks/bank-a/audit"');
    expect(html).toContain('href="/dashboard/coordinator/question-banks/bank-a/uaf-review"');
  });
  it("renders every assigned bank, actual counts and report links with a safe zero denominator", () => {
    const banks = Array.from({ length: 8 }, (_, i) => ({ id: `bank-${i}`, subjectName: `Subject ${i}`, subjectCode: `S${i}`, semesterLabel: "Sem 1", department: "IT", phase: "DRAFTING", totalSlots: i === 7 ? 0 : 10, filledCount: i === 7 ? 0 : 6, approvedCount: 2, pendingModerationCount: 1 }));
    const html = renderToStaticMarkup(createElement(CoordinatorBankComparison, { banks }));
    expect(html).toContain("Subject 7");
    expect(html).toContain("6/10 (60%)");
    expect(html).toContain("0/0 (N/A)");
    expect(html).toContain('href="/dashboard/coordinator/analysis?bank=bank-7"');
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("Infinity");
  });
  it("renders an explicit empty comparison", () => {
    expect(renderToStaticMarkup(createElement(CoordinatorBankComparison, { banks: [] }))).toContain("No assigned question banks to compare.");
  });
});
