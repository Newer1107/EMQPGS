import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeanBankComparison } from "@/components/dashboard/dean-bank-comparison";

describe("Dean cross-bank comparison navigation", () => {
  it("links every queued bank and preserves zero versus missing scores", () => {
    const html = renderToStaticMarkup(createElement(DeanBankComparison, { currentBankId: "first", banks: [
      { id: "first", subjectCode: "M1", subjectName: "Math", examCycleLabel: "Regular", qualityScore: 0, coverageScore: 0, daysWaiting: 8 },
      { id: "second", subjectCode: "P1", subjectName: "Physics", examCycleLabel: "Supplementary", qualityScore: null, coverageScore: null, daysWaiting: 2 },
    ] }));
    expect(html).toContain("?bank=first");
    expect(html).toContain("?bank=second");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("0%");
    expect(html).toContain("Unavailable");
    expect(html).toContain("Supplementary");
  });
  it("provides an empty state without inventing scores", () => {
    const html = renderToStaticMarkup(createElement(DeanBankComparison, { banks: [] }));
    expect(html).toContain("No pending banks to compare");
    expect(html).not.toContain("<table");
  });
});
