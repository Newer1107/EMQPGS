import { describe, expect, it, vi } from "vitest";
import { applyLatestUafReview, applyReviewEvidence } from "@/modules/uaf-review/adapter";
import { buildReviewSource } from "@/modules/uaf-review/source";
import { computeAMI, computeCAI, computeFRI, computeQCQI, computeCOA, computeMCS } from "@/lib/uaf/metric-engine";
import { bankFixture, rawFixture, reviewFixture, sourceFixture } from "./uaf-review-fixtures";

const { tx } = vi.hoisted(() => ({ tx: { uafReview: { findFirst: vi.fn() }, questionBank: { findUnique: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: (callback: (db: typeof tx) => unknown) => callback(tx) } }));
const stored = () => ({ id: "review-1", version: 1, reviewerId: "reviewer", evidence: reviewFixture() });

describe("saved review to UAF evidence adapter", () => {
  it("calculates QCQI/AMI/FRI/CAI/MCS from reviewed evidence, including negative verdicts", () => {
    const result = applyReviewEvidence(rawFixture(), sourceFixture(), stored());
    expect(computeQCQI(result).value).toBe(0.5);
    expect(computeAMI(result).value).toBe(0);
    expect(computeFRI(result).value).toBe(1);
    expect(computeCAI(result).value).toBe(1);
    expect(computeMCS(result).value).toBe(0);
    expect(computeCOA(result).value).toBe(0);
    expect(result.questions[0].coStatus).toBe("VERIFIED");
    expect(result.questions[0].coMapping).toBe("CO1");
    expect(result.questions[0].qualityEvidence?.clarity?.sourceIds).toContain("uaf-review:review-1:question:q1:QCQI:clarity");
    expect(result.indexConfidence?.AMI).toEqual({ verified: 7, required: 7 });
  });
  it("requires all seven quality scores and all CAI flags; no heuristic defaults", () => {
    const review = stored();
    review.evidence.questions[0].qcqi.pop(); review.evidence.questions[0].cai.pop(); review.evidence.bankCriteria.FRI.pop();
    const result = applyReviewEvidence(rawFixture(), sourceFixture(), review);
    expect(computeQCQI(result).value).toBeNull();
    expect(computeCAI(result).value).toBeNull();
    expect(computeFRI(result).value).toBeNull();
    expect(result.indexConfidence?.QCQI).toEqual({ verified: 6, required: 7 });
  });
  it("CAI requires all four flags satisfied, not their average", () => {
    const review = stored(); review.evidence.questions[0].cai[0].satisfied = false;
    const result = applyReviewEvidence(rawFixture(), sourceFixture(), review);
    expect(computeCAI(result).value).toBe(0);
    expect(result.indexConfidence?.CAI).toEqual({ verified: 4, required: 4 });
  });
  it("invalidates review when updatedAt changes, even if text is identical", () => {
    const result = applyReviewEvidence(rawFixture(), sourceFixture("2026-09-02T00:00:00Z"), stored());
    expect(computeQCQI(result).value).toBeNull(); expect(computeAMI(result).value).toBeNull();
    expect(result.questions[0].attributeAccuracy).toBeUndefined();
    expect(result.reviewProvenance?.staleQuestionIds).toEqual(["q1"]);
  });
  it("preserves current question review but invalidates bank criteria when bank configuration changes", () => {
    const source = sourceFixture(); source.bankFingerprint = "a".repeat(64);
    const result = applyReviewEvidence(rawFixture(), source, stored());
    expect(computeQCQI(result).value).toBe(0.5); expect(computeAMI(result).value).toBeNull();
  });
  it.each(["questionText", "sourceSlotNumber", "subjectName", "totalSlots"])("fails closed on mixed collector/source snapshots: %s", field => {
    const raw = rawFixture();
    if (field === "questionText") raw.questions[0].questionText = "Old question";
    if (field === "sourceSlotNumber") raw.questions[0].sourceSlotNumber = 2;
    if (field === "subjectName") raw.subjectName = "Old subject";
    if (field === "totalSlots") raw.totalSlots = 2;
    const result = applyReviewEvidence(raw, sourceFixture(), stored());
    expect(computeQCQI(result).value).toBeNull(); expect(computeAMI(result).value).toBeNull();
  });
  it("fingerprints content and versions deterministically", () => {
    const bank = bankFixture();
    expect(sourceFixture().bankFingerprint).toBe(buildReviewSource(bank as never).bankFingerprint);
    bank.slots[0].assignedQuestion.questionText = "Changed question";
    expect(buildReviewSource(bank as never).questions[0].questionVersion).not.toBe(sourceFixture().questions[0].questionVersion);
  });
  it("queries the latest saved version and ignores unsupported JSON without using an older review", async () => {
    tx.uafReview.findFirst.mockResolvedValue({ ...stored(), evidence: { schemaVersion: 99 } });
    tx.questionBank.findUnique.mockResolvedValue(bankFixture());
    const raw = rawFixture();
    expect(await applyLatestUafReview(raw)).toEqual(raw);
    expect(tx.uafReview.findFirst).toHaveBeenCalledWith({ where: { questionBankId: "bank" }, orderBy: { version: "desc" } });
  });
  it("includes stable reviewer/version provenance and never adds runtime timestamps", () => {
    const raw = rawFixture();
    const a = applyReviewEvidence(raw, sourceFixture(), stored());
    const b = applyReviewEvidence(raw, sourceFixture(), stored());
    expect(a).toEqual(b);
    expect(a.reviewProvenance).toMatchObject({ reviewId: "review-1", version: 1, reviewerId: "reviewer" });
    expect(JSON.stringify(a.reviewProvenance)).not.toContain("createdAt");
  });
});
