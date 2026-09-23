import { CRITERIA, RUBRIC_VERSION, SECTIONS } from "./criteria";
import type { Assessment, Blueprint } from "./validation";

export type AuditQuestion = {
  id: string; questionText: string; moduleNumber: number; coMapping: string;
  rbtLevel: string; marks: number; questionType: string | null;
  piMapping: unknown; poMapping: unknown; difficultyLevel: string | null;
};
export type Source = {
  questions: AuditQuestion[];
  slots: { id: string; slotNumber: number; assignedQuestionId: string | null }[];
  approvals?: { id: string; decision: string; decidedById: string; decidedAt: Date | string }[];
};
export type Result = typeof CRITERIA[number] & {
  answer: "YES" | "NO"; score: number; evidence: string; reason: string;
  source: "RECORDS" | "EVALUATOR" | "MISSING";
};
export function decisionFor(score: number) {
  if (!Number.isInteger(score) || score < 0 || score > 1000) throw new Error("Invalid audit score");
  return score >= 900 ? "APPROVED" : score >= 750 ? "APPROVED_WITH_MINOR_CORRECTIONS" : "REVISION_REQUIRED";
}
const mapped = (value: unknown) => Array.isArray(value) && value.length > 0 && value.every(v => typeof v === "string" && v.trim().length > 0);

/** Full satisfaction only. Empty banks cannot pass universal predicates. */
export function evaluate(source: Source, blueprint: Blueprint | null, assessments: Assessment[] = []) {
  const q = source.questions;
  const every = (fn: (x: AuditQuestion) => boolean) => q.length > 0 && q.every(fn);
  const auto = new Map<string, { yes: boolean; evidence: string; reason: string }>();
  const set = (ids: string[], yes: boolean, evidence: unknown, reason: string) => ids.forEach(id => auto.set(id, {
    yes, evidence: JSON.stringify(evidence), reason: yes ? "Criterion verified against the frozen source records." : reason,
  }));
  const fields = (name: keyof AuditQuestion) => q.map(x => ({ id: x.id, value: x[name] }));
  const approvals = source.approvals ?? [];
  set(["I8"], approvals.length > 0, approvals, "No stored authenticated approval decision is available; evaluator text is not an approval record.");
  set(["I10", "J10"], approvals.some(a => a.decision === "APPROVED" && !!a.decidedById), approvals, "No approval by a recorded authenticated authority is available.");
  set(["A1"], q.length > 0 && q.every(x => source.slots.some(s => s.assignedQuestionId === x.id && s.slotNumber > 0)), source.slots, "Missing question or slot serial number.");
  set(["A2"], every(x => !!x.questionText.trim()), fields("questionText"), "Question text is missing or the bank is empty.");
  set(["A3", "C1"], every(x => /^CO[1-6]$/.test(x.coMapping)), fields("coMapping"), "CO mapping is missing or invalid.");
  set(["A4", "D1"], every(x => /^L[1-6]$/.test(x.rbtLevel)), fields("rbtLevel"), "RBT mapping is missing or invalid.");
  set(["A5", "E1"], every(x => mapped(x.piMapping)), fields("piMapping"), "PI mapping is missing; legacy unknowns are not evidence.");
  set(["A6", "G1"], every(x => Number.isInteger(x.marks) && x.marks > 0), fields("marks"), "Positive marks are missing.");
  const typed = every(x => x.questionType === "THEORY" || x.questionType === "NUMERICAL");
  set(["A7", "F1"], typed, fields("questionType"), "Question type is unknown for one or more questions, or the bank is empty.");
  set(["A8"], every(x => Number.isInteger(x.moduleNumber) && x.moduleNumber > 0), fields("moduleNumber"), "Module mapping is missing.");
  set(["A9"], ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"].every(id => auto.get(id)?.yes), q, "One or more mandatory fields are missing.");
  const counts = (key: keyof AuditQuestion, weight = false) => q.reduce<Record<string, number>>((out, x) => {
    const label = String(x[key] ?? "UNKNOWN"); out[label] = (out[label] ?? 0) + (weight ? x.marks : 1); return out;
  }, {});
  set(["B9"], q.length > 0, counts("moduleNumber"), "No module counts are available for an empty bank.");
  set(["C3", "C10"], every(x => !!x.coMapping), fields("coMapping"), "CO mapping records are incomplete.");
  set(["C8"], every(x => !!x.coMapping && x.marks > 0), counts("coMapping", true), "CO marks records are incomplete.");
  ["L1", "L2", "L3"].forEach((level, i) => set([`D${i + 2}`], q.some(x => x.rbtLevel === level), fields("rbtLevel"), `No ${level} questions available.`));
  set(["D5", "D6"], q.some(x => ["L4", "L5", "L6"].includes(x.rbtLevel)), fields("rbtLevel"), "No higher-order RBT questions available.");
  set(["D9"], every(x => /^L[1-6]$/.test(x.rbtLevel)), counts("rbtLevel"), "RBT distribution is incomplete.");
  set(["E6", "E9"], every(x => mapped(x.piMapping)), fields("piMapping"), "PI mapping records are incomplete.");
  const distribution = (items: AuditQuestion[]) => ({
    count: items.length,
    theory: items.length ? 100 * items.filter(x => x.questionType === "THEORY").length / items.length : 0,
    numerical: items.length ? 100 * items.filter(x => x.questionType === "NUMERICAL").length / items.length : 0,
    unknown: items.filter(x => !["THEORY", "NUMERICAL"].includes(x.questionType ?? "")).length,
  });
  const global = distribution(q);
  const moduleDistribution = [...new Set(q.map(x => x.moduleNumber))].map(module => ({ module, ...distribution(q.filter(x => x.moduleNumber === module)) }));
  set(["F2", "F3"], typed, moduleDistribution, "Cannot document complete percentages while types are unknown or bank is empty.");
  set(["F5", "F6", "F10"], typed, { global, moduleDistribution }, "Theory–Numerical evidence is incomplete.");
  ["EASY", "MEDIUM", "HARD"].forEach((level, i) => set([`G${i + 7}`], q.some(x => x.difficultyLevel === level), fields("difficultyLevel"), `No ${level} questions available.`));
  set(["G10"], every(x => ["EASY", "MEDIUM", "HARD"].includes(x.difficultyLevel ?? "")), counts("difficultyLevel"), "Difficulty metadata is incomplete.");
  if (blueprint) {
    set(["B1"], q.length > 0 && blueprint.table1.every(m => q.some(x => x.moduleNumber === m.module)), blueprint.table1, "A prescribed module has no questions.");
    set(["B2"], every(x => blueprint.table1.some(m => m.module === x.moduleNumber)), { modules: counts("moduleNumber"), table1: blueprint.table1 }, "A question is outside the prescribed modules.");
    set(["B7"], every(x => blueprint.table1.some(m => m.module === x.moduleNumber && m.co.some(co => co === x.coMapping))), { questions: q.map(x => ({ id: x.id, module: x.moduleNumber, co: x.coMapping })), table1: blueprint.table1 }, "A question's Module–CO mapping does not follow Table 1.");
    set(["C2"], q.length > 0 && blueprint.table1.flatMap(m => m.co).every(co => q.some(x => x.coMapping === co)), { actual: counts("coMapping"), table1: blueprint.table1 }, "A prescribed CO is not represented.");
    const close = (a: number, b: number) => Math.abs(a - b) < 0.000001;
    set(["F4"], typed && auto.get("B2")!.yes && blueprint.table2.every(m => {
      const actual = moduleDistribution.find(d => d.module === m.module);
      return !!actual && close(actual.theory, m.theory) && close(actual.numerical, m.numerical);
    }), { actual: moduleDistribution, table2: blueprint.table2 }, "Module percentages do not match Table 2 (no unstated tolerance is applied).");
    set(["F7"], typed && close(global.theory, blueprint.table3.theory) && close(global.numerical, blueprint.table3.numerical), { actual: global, table3: blueprint.table3 }, "Overall percentages do not match Table 3.");
  }
  const results: Result[] = CRITERIA.map(criterion => {
    const computed = auto.get(criterion.id);
    // Objective record failures cannot be overridden by evaluator assertions.
    if (computed) return { ...criterion, answer: computed.yes ? "YES" : "NO", score: computed.yes ? 10 : 0, evidence: computed.evidence, reason: computed.reason, source: "RECORDS" };
    const manual = assessments.find(a => a.criterionId === criterion.id);
    const needsBlueprint = ["B", "C", "F", "J"].includes(criterion.section);
    if (needsBlueprint && !blueprint) return { ...criterion, answer: "NO", score: 0, evidence: "", reason: "Missing mandatory academic blueprint Tables 1, 2 and 3.", source: "MISSING" };
    const yes = manual?.answer === "YES" && !!manual.evidence.trim();
    return { ...criterion, answer: yes ? "YES" : "NO", score: yes ? 10 : 0,
      evidence: manual?.evidence ?? "", source: manual?.evidence ? "EVALUATOR" : "MISSING",
      reason: !manual?.evidence ? "Missing supporting evidence; criterion cannot be verified." : manual.reason || (yes ? "Evaluator verified the cited evidence." : "Evaluator recorded that the criterion is not satisfied."),
    };
  });
  const score = results.reduce((sum, r) => sum + r.score, 0);
  return { rubricVersion: RUBRIC_VERSION, results, score, maxScore: 1000,
    decision: decisionFor(score), sectionScores: Object.fromEntries(SECTIONS.map(s => [s.id, results.filter(r => r.section === s.id).reduce((n, r) => n + r.score, 0)])),
  };
}
