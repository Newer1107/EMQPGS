import { createHash } from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CRITERIA, SECTIONS } from "@/modules/qb-audit/criteria";
import { decisionFor, evaluate, type Source } from "@/modules/qb-audit/engine";
import { blueprintSchema, draftSchema, type Blueprint } from "@/modules/qb-audit/validation";
import type { AuthContext } from "@/lib/types";
import { sourceHash } from "@/modules/qb-audit/source-hash";

vi.mock("@/lib/db", () => ({ prisma: {} }));
import { QBAuditService, requireAuditAccess } from "@/modules/qb-audit/service";

const blueprint: Blueprint = { schemaVersion: 1, syllabusReference: "Approved syllabus 2026", table1: [{ module: 1, co: ["CO1"], name: "Mechanics", hours: 10 }], table2: [{ module: 1, theory: 50, numerical: 50 }], table3: { theory: 50, numerical: 50 } };
const source: Source = {
  approvals: [{ id: "approval1", decision: "APPROVED", decidedById: "coordinator1", decidedAt: "2026-09-23T00:00:00.000Z" }],
  questions: Array.from({ length: 6 }, (_, i) => ({ id: `q${i}`, questionText: `Question ${i}`, moduleNumber: 1, coMapping: "CO1", rbtLevel: `L${i + 1}`, marks: 5, questionType: i % 2 ? "THEORY" : "NUMERICAL", poMapping: ["PO1"], piMapping: ["PI1"], difficultyLevel: ["EASY", "MEDIUM", "HARD"][i % 3] })),
  slots: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, slotNumber: i + 1, assignedQuestionId: `q${i}` })),
};
const allYes = CRITERIA.map(c => ({ criterionId: c.id, answer: "YES" as const, evidence: "Signed subject-expert review 2026-09-23, findings for this criterion verified against all six source questions.", reason: "Reviewed and satisfied." }));
const auth: AuthContext = { user: { id: "user1", name: "Evaluator", email: "e@example.com" }, responsibilities: [{ id: "r1", type: "COORDINATOR", scopeType: "DEPARTMENT", scopeId: "dept1", activeFrom: new Date("2020-01-01"), activeTo: null }] };

describe("exact PDF rubric and evidence scoring", () => {
  it("matches all 100 PDF criterion texts, in A1–J10 order", () => {
    expect(CRITERIA).toHaveLength(100);
    expect(new Set(CRITERIA.map(c => c.id)).size).toBe(100);
    expect(SECTIONS.every(s => s.criteria.length === 10)).toBe(true);
    expect(CRITERIA.map(c => c.id)).toEqual("ABCDEFGHIJ".split("").flatMap(s => Array.from({ length: 10 }, (_, i) => `${s}${i + 1}`)));
    // Independently extracted from PDF pages 2–11 with pypdf; only wrap hyphenation removed.
    const digest = createHash("sha256").update(CRITERIA.map(c => `${c.id} ${c.text}`).join("\n")).digest("hex");
    expect(digest).toBe("e18f9130e7104b270f3d4da3c2c82c137cc12f01ef5fb71db17ac5f46f86157c");
  });
  it.each([[0,"REVISION_REQUIRED"],[749,"REVISION_REQUIRED"],[750,"APPROVED_WITH_MINOR_CORRECTIONS"],[899,"APPROVED_WITH_MINOR_CORRECTIONS"],[900,"APPROVED"],[1000,"APPROVED"]])("decision at %i", (score, decision) => expect(decisionFor(score as number)).toBe(decision));
  it("awards exactly ten points for each evidenced Yes, 100 per section", () => {
    const result = evaluate(source, blueprint, allYes);
    expect(result.results.every(r => r.answer === "YES" && r.score === 10 && r.evidence.length > 0)).toBe(true);
    expect(result.score).toBe(1000);
    expect(Object.values(result.sectionScores)).toEqual(Array(10).fill(100));
  });
  it("does not pass an empty bank through vacuous universal predicates", () => {
    const result = evaluate({ questions: [], slots: [] }, null);
    expect(result.score).toBe(0);
    expect(result.results.every(r => r.answer === "NO" && r.reason.length > 0)).toBe(true);
  });
  it("marks unsupported Yes as No with reason, and preserves negative observations", () => {
    const result = evaluate(source, blueprint, [{ criterionId: "H1", answer: "YES", evidence: "", reason: "looks good" }, { criterionId: "H2", answer: "NO", evidence: "Q1 review", reason: "Ambiguous wording" }]);
    expect(result.results.find(r => r.id === "H1")).toMatchObject({ answer: "NO", source: "MISSING" });
    expect(result.results.find(r => r.id === "H2")).toMatchObject({ answer: "NO", reason: "Ambiguous wording" });
  });
  it("retains unknown legacy types and PI, rejecting manual overrides of record failures", () => {
    const result = evaluate({ ...source, questions: source.questions.map(q => ({ ...q, questionType: null, piMapping: null })) }, blueprint, allYes);
    for (const id of ["A5", "A7", "A9", "E1", "F1", "F4", "F7"]) expect(result.results.find(r => r.id === id)?.answer).toBe("NO");
  });
  it("requires blueprint evidence and detects prescribed-module/CO/distribution mismatches", () => {
    const missing = evaluate(source, null, allYes);
    for (const id of ["B1", "B7", "C2", "F4", "F7", "J8"]) expect(missing.results.find(r => r.id === id)?.answer).toBe("NO");
    const wrong = evaluate({ ...source, questions: source.questions.map(q => ({ ...q, moduleNumber: 2, coMapping: "CO2", questionType: "THEORY" })) }, blueprint, allYes);
    for (const id of ["B1", "B2", "B7", "C2", "F4", "F7"]) expect(wrong.results.find(r => r.id === id)?.answer).toBe("NO");
  });
  it("validates all three blueprint tables and prevents submitted evaluator impersonation", () => {
    expect(blueprintSchema.safeParse(blueprint).success).toBe(true);
    expect(blueprintSchema.safeParse({ ...blueprint, table3: { theory: 70, numerical: 50 } }).success).toBe(false);
    expect(blueprintSchema.safeParse({ ...blueprint, table2: [{ module: 2, theory: 50, numerical: 50 }] }).success).toBe(false);
    expect(blueprintSchema.safeParse({ ...blueprint, table1: [...blueprint.table1, ...blueprint.table1] }).success).toBe(false);
    expect(blueprintSchema.safeParse({ ...blueprint, table1: [{ ...blueprint.table1[0], hours: 0 }] }).success).toBe(false);
    expect(draftSchema.safeParse({ assessments: [], remarks: "", evaluatorId: "forged" }).success).toBe(false);
    expect(draftSchema.safeParse({ assessments: [allYes[0], allYes[0]], remarks: "" }).success).toBe(false);
  });
  it("cannot replace authentic approval records with arbitrary review text", () => {
    const result = evaluate({ ...source, approvals: [] }, blueprint, allYes);
    for (const id of ["I8", "I10", "J10"]) expect(result.results.find(r => r.id === id)).toMatchObject({ answer: "NO", source: "RECORDS" });
  });
  it("hashes deterministically and detects changed question, slot, approval and blueprint evidence", () => {
    const hash = sourceHash(source, blueprint);
    expect(sourceHash({ ...source, questions: [...source.questions].reverse(), slots: [...source.slots].reverse() }, blueprint)).toBe(hash);
    expect(sourceHash({ ...source, questions: source.questions.map(q => ({ ...q, questionText: "changed" })) }, blueprint)).not.toBe(hash);
    expect(sourceHash({ ...source, slots: [] }, blueprint)).not.toBe(hash);
    expect(sourceHash({ ...source, approvals: [] }, blueprint)).not.toBe(hash);
    expect(sourceHash(source, { ...blueprint, version: 2 })).not.toBe(hash);
  });
});

describe("scoped audit authorization", () => {
  it("allows only active coordinators assigned to this department", () => {
    expect(() => requireAuditAccess(auth, "dept1")).not.toThrow();
    expect(() => requireAuditAccess(auth, "dept2")).toThrow(/coordinator/);
    for (const responsibility of [
      { ...auth.responsibilities[0], type: "CONTRIBUTOR" as const },
      { ...auth.responsibilities[0], type: "COE" as const, scopeType: "INSTITUTION" as const },
      { ...auth.responsibilities[0], activeTo: new Date("2021-01-01") },
      { ...auth.responsibilities[0], activeFrom: new Date("2099-01-01") },
    ]) expect(() => requireAuditAccess({ ...auth, responsibilities: [responsibility] }, "dept1")).toThrow();
  });
});

describe("append-only snapshot persistence and finalization", () => {
  const bank = { id: "bank1", version: 3, subject: { departmentId: "dept1" } };
  const draft = { id: "draft1", questionBankId: "bank1", version: 1, status: "DRAFT", remarks: "Reviewed", score: 750, decision: "APPROVED_WITH_MINOR_CORRECTIONS", payload: { sourceHash: sourceHash(source, { id: "bp1", version: 1, data: blueprint }), frozenEvidence: ["original"], evaluator: { id: "originalEvaluator" } } };
  const tx = {
    $queryRaw: vi.fn(), questionBank: { findUnique: vi.fn() }, department: { findUnique: vi.fn() },
    questionSlot: { findMany: vi.fn() },
    approvalDecision: { findMany: vi.fn() },
    qBAuditBlueprint: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    qBAuditSnapshot: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  };
  const db = { $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(tx)) };
  const service = new QBAuditService(db as unknown as ConstructorParameters<typeof QBAuditService>[0]);
  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation(async fn => fn(tx));
    tx.questionBank.findUnique.mockResolvedValue(bank);
    tx.qBAuditSnapshot.findFirst.mockResolvedValue(draft);
    tx.qBAuditSnapshot.findUnique.mockResolvedValue(null);
    tx.qBAuditSnapshot.create.mockImplementation(async ({ data }) => ({ id: "new", ...data }));
    tx.questionSlot.findMany.mockResolvedValue(source.slots.map((s,i) => ({ ...s, assignedQuestion: source.questions[i] })));
    tx.approvalDecision.findMany.mockResolvedValue(source.approvals);
    tx.qBAuditBlueprint.findFirst.mockResolvedValue({ id: "bp1", version: 1, data: blueprint });
  });
  it("finalizes by appending the frozen draft and session identity without recomputing", async () => {
    const final = await service.finalize(auth, "bank1", { draftId: "draft1" });
    expect(final).toMatchObject({ status: "FINAL", score: 750, finalizedFromId: "draft1", evaluatorId: "user1", evaluatorName: "Evaluator", payload: { frozenEvidence: ["original"], finalizer: { id: "user1" } } });
    expect(tx.questionSlot.findMany).toHaveBeenCalled();
    expect(draft.status).toBe("DRAFT");
  });
  it("rejects cross-bank drafts using an explicitly bank-scoped lookup", async () => {
    tx.qBAuditSnapshot.findFirst.mockResolvedValue(null);
    await expect(service.finalize(auth, "bank1", { draftId: "foreign" })).rejects.toThrow(/not found/);
    expect(tx.qBAuditSnapshot.findFirst).toHaveBeenCalledWith({ where: { id: "foreign", questionBankId: "bank1" } });
    expect(tx.qBAuditSnapshot.create).not.toHaveBeenCalled();
  });
  it("rejects changes to questions or newer blueprint before finalization", async () => {
    tx.questionSlot.findMany.mockResolvedValueOnce(source.slots.map((s,i) => ({ ...s, assignedQuestion: { ...source.questions[i], questionText: "Changed" } })));
    await expect(service.finalize(auth, "bank1", { draftId: "draft1" })).rejects.toThrow(/stale/);
    tx.qBAuditBlueprint.findFirst.mockResolvedValueOnce({ id: "bp2", version: 2, data: blueprint });
    await expect(service.finalize(auth, "bank1", { draftId: "draft1" })).rejects.toThrow(/stale/);
    expect(tx.qBAuditSnapshot.create).not.toHaveBeenCalled();
  });
  it("rejects finalized, duplicate and superseded drafts", async () => {
    tx.qBAuditSnapshot.findFirst.mockResolvedValueOnce({ ...draft, status: "FINAL" });
    await expect(service.finalize(auth, "bank1", { draftId: "draft1" })).rejects.toThrow(/Only a draft/);
    tx.qBAuditSnapshot.findUnique.mockResolvedValueOnce({ id: "final1" });
    await expect(service.finalize(auth, "bank1", { draftId: "draft1" })).rejects.toThrow(/already/);
    tx.qBAuditSnapshot.findFirst.mockResolvedValueOnce(draft).mockResolvedValueOnce({ ...draft, id: "draft2", version: 2 });
    await expect(service.finalize(auth, "bank1", { draftId: "draft1" })).rejects.toThrow(/superseded/);
    expect(tx.qBAuditSnapshot.create).not.toHaveBeenCalled();
  });
  it("enforces scope on read, blueprint writes, draft writes and finalization", async () => {
    tx.questionBank.findUnique.mockResolvedValue({ ...bank, subject: { departmentId: "foreign" } });
    await expect(service.get(auth, "bank1")).rejects.toThrow(/coordinator/);
    await expect(service.saveBlueprint(auth, "bank1", blueprint)).rejects.toThrow(/coordinator/);
    await expect(service.saveDraft(auth, "bank1", { assessments: [], remarks: "" })).rejects.toThrow(/coordinator/);
    await expect(service.finalize(auth, "bank1", { draftId: "draft1" })).rejects.toThrow(/coordinator/);
    expect(tx.qBAuditSnapshot.create).not.toHaveBeenCalled();
    expect(tx.qBAuditBlueprint.create).not.toHaveBeenCalled();
  });
  it("captures actual question data, blueprint and authenticated evaluator in a new draft", async () => {
    tx.questionSlot.findMany.mockResolvedValue(source.slots.map((s,i) => ({ ...s, assignedQuestion: source.questions[i] })));
    tx.qBAuditBlueprint.findFirst.mockResolvedValue({ id: "bp1", version: 1, data: blueprint });
    tx.department.findUnique.mockResolvedValue({ name: "Engineering" });
    const saved = await service.saveDraft(auth, "bank1", { assessments: allYes, remarks: "Verified" });
    expect(saved).toMatchObject({ status: "DRAFT", version: 2, evaluatorId: "user1", score: 1000, payload: { source, blueprint: { id: "bp1" }, evaluator: { id: "user1", departmentName: "Engineering" } } });
  });
  it("allows append-only audits of locked banks and never serializes additional auth fields", async () => {
    tx.questionBank.findUnique.mockResolvedValue({ ...bank, recordStatus: "LOCKED" });
    tx.department.findUnique.mockResolvedValue({ name: "Engineering" });
    const enriched = { ...auth, user: { ...auth.user, passwordHash: "secret", accessToken: "secret-token" } };
    const saved = await service.saveDraft(enriched, "bank1", { assessments: [], remarks: "Historical audit" });
    expect(saved.status).toBe("DRAFT");
    expect(JSON.stringify(saved.payload)).not.toContain("secret");
    const final = await service.finalize(enriched, "bank1", { draftId: "draft1" });
    expect(final.status).toBe("FINAL");
    expect(JSON.stringify(final.payload)).not.toContain("secret");
  });
});
