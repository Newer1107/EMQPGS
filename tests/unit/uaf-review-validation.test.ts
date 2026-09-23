import { describe, expect, it } from "vitest";
import { saveReviewSchema } from "@/modules/uaf-review/validation";
import { reviewFixture } from "./uaf-review-fixtures";

describe("review evidence schema", () => {
  it("accepts explicit zero, incorrect verdicts and complete referenced evidence", () => {
    expect(saveReviewSchema.parse({ baseVersion: 0, evidence: reviewFixture() }).evidence.bankCriteria.AMI[0].score).toBe(0);
  });
  it.each([
    (value: ReturnType<typeof reviewFixture>) => { value.questions[0].qcqi[0].evidence.reference = " "; },
    (value: ReturnType<typeof reviewFixture>) => { value.questions[0].qcqi[0].evidence.rationale = ""; },
    (value: ReturnType<typeof reviewFixture>) => { value.questions[0].qcqi[0].score = 1.1; },
    (value: ReturnType<typeof reviewFixture>) => { value.questions[0].qcqi[0].score = NaN; },
    (value: ReturnType<typeof reviewFixture>) => { value.questions[0].qcqi.push(value.questions[0].qcqi[0]); },
    (value: ReturnType<typeof reviewFixture>) => { value.questions.push(value.questions[0]); },
    (value: ReturnType<typeof reviewFixture>) => { value.questions[0].questionVersion = "unversioned"; },
  ])("rejects missing sources, invalid scores, duplicates and unversioned input (%#)", change => {
    const evidence = reviewFixture(); change(evidence);
    expect(saveReviewSchema.safeParse({ baseVersion: 0, evidence }).success).toBe(false);
  });
  it("rejects unsupported criteria, source types, fractional binary scores and forged actor/confidence fields", () => {
    const evidence = reviewFixture();
    for (const invalid of [
      { ...evidence, bankCriteria: { ...evidence.bankCriteria, AMI: [{ ...evidence.bankCriteria.AMI[0], criterion: "heuristic" }] } },
      { ...evidence, bankCriteria: { ...evidence.bankCriteria, AMI: [{ ...evidence.bankCriteria.AMI[0], score: 0.5 }] } },
      { ...evidence, bankCriteria: { ...evidence.bankCriteria, AMI: [{ ...evidence.bankCriteria.AMI[0], evidence: { ...evidence.bankCriteria.AMI[0].evidence, sourceType: "AI_GUESS" } }] } },
      { ...evidence, indexConfidence: { QCQI: { verified: 100, required: 100 } } },
    ]) expect(saveReviewSchema.safeParse({ baseVersion: 0, evidence: invalid }).success).toBe(false);
    expect(saveReviewSchema.safeParse({ baseVersion: 0, evidence, reviewerId: "someone-else" }).success).toBe(false);
  });
});
