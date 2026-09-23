import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SlotDemand } from "@/components/forms/slot-demand";
import { BankSlotsView, SlotContributionAction } from "@/components/dashboard/bank-slots-view";
import type { SlotItem } from "@/components/dashboard/slot-grid";

const empty: SlotItem = { moduleNumber: 8, marks: 15, slotNumber: 1, isLocked: false, assignedQuestion: null };
describe("bank slot guidance", () => {
  it("derives module and marks axes from actual slots, with no zero-demand recommendation", () => {
    const html = renderToStaticMarkup(createElement(SlotDemand, { slots: [{ ...empty, filled: true }] }));
    expect(html).toContain("M8");
    expect(html).toContain("15mk");
    expect(html).not.toContain("2mk");
    expect(html).not.toContain("Recommended:");
  });
  it("recommends a real unfilled group and excludes locked slots", () => {
    const html = renderToStaticMarkup(createElement(SlotDemand, { slots: [
      { ...empty, filled: false }, { ...empty, marks: 20, filled: false, isLocked: true },
    ] }));
    expect(html).toContain("Recommended: Module 8, 15 marks (1 empty slot)");
    const locked = renderToStaticMarkup(createElement(SlotDemand, { slots: [{ ...empty, filled: false, isLocked: true }], selectedModule: "8", selectedMarks: "15" }));
    expect(locked).toContain("remaining slots are locked");
    expect(locked).not.toContain("Recommended:");
  });
  it("shows filled and approved counts separately per module", () => {
    const html = renderToStaticMarkup(createElement(BankSlotsView, {
      subjectName: "Math", subjectCode: "M1", batchName: "Batch", semesterNumber: 1, academicYearCode: "2026",
      totalSlots: 1, modules: [8], marksOptions: [15], slots: [empty],
    }));
    expect(html).toContain("Module completion");
    expect(html).toContain("0/1 filled · 0 approved");
  });
  it("links an empty slot to a prefilled form only when contributing is enabled", () => {
    const html = renderToStaticMarkup(createElement(SlotContributionAction, { slot: empty, href: "/dashboard/contributor/submit-question" }));
    expect(html).toContain("?module=8&amp;marks=15");
    expect(renderToStaticMarkup(createElement(SlotContributionAction, { slot: empty }))).toBe("");
    expect(renderToStaticMarkup(createElement(SlotContributionAction, { slot: { ...empty, isLocked: true }, href: "/submit" }))).not.toContain("href");
  });
});
