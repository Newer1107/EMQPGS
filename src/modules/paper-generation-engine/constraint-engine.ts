import type { QuestionLibraryItem, QuestionUsageHistory } from "@prisma/client";
import { QuestionStatus } from "@prisma/client";
import type { PaperSlot, SlotAssignment } from "./types";
import { MARKS_PATTERN } from "./types";

export type ConstraintViolation = {
  rule: string;
  message: string;
};

export type ConstraintResult = {
  valid: boolean;
  violations: ConstraintViolation[];
};

export type ConstraintConfig = {
  moduleRange: number[];
  /** If true, questions in QuestionUsageHistory are excluded. */
  enforceUsageHistory: boolean;
  /** If true, duplicate teachingIndex values are blocked. */
  enforceConceptDiversity: boolean;
};

export class ConstraintEngine {
  constructor(private readonly config: ConstraintConfig) {}

  /** Validate that every slot can be filled with a valid question. Quick pre-flight check. */
  validateBankState(
    slots: PaperSlot[],
    availableQuestions: Map<string, QuestionLibraryItem[]>,
  ): ConstraintResult {
    const violations: ConstraintViolation[] = [];

    // -- Module range --
    for (const slot of slots) {
      if (!this.config.moduleRange.includes(slot.moduleNumber)) {
        violations.push({
          rule: "MODULE_RANGE",
          message: `Slot M${slot.moduleNumber} (${slot.marks}m) is outside exam module range [${this.config.moduleRange.join(", ")}].`,
        });
      }
    }

    // -- Marks pattern --
    for (const slot of slots) {
      if (!(MARKS_PATTERN as readonly number[]).includes(slot.marks)) {
        violations.push({
          rule: "MARKS_PATTERN",
          message: `Slot M${slot.moduleNumber} has invalid marks value ${slot.marks}. Must be one of ${MARKS_PATTERN.join(", ")}.`,
        });
      }
    }

    // -- Slot count --
    const expected = this.config.moduleRange.length * MARKS_PATTERN.length;
    if (slots.length !== expected) {
      violations.push({
        rule: "SLOT_COUNT",
        message: `Expected ${expected} slots for ${this.config.moduleRange.length} modules × ${MARKS_PATTERN.length} marks, got ${slots.length}.`,
      });
    }

    // -- Available questions --
    for (const slot of slots) {
      const key = slotKey(slot.moduleNumber, slot.marks);
      const candidates = availableQuestions.get(key) ?? [];
      if (candidates.length === 0) {
        violations.push({
          rule: "INSUFFICIENT_INVENTORY",
          message: `No approved questions available for M${slot.moduleNumber} ${slot.marks}-mark slot.`,
        });
      }
    }

    return { valid: violations.length === 0, violations };
  }

  /** Validate a complete assignment list against ALL hard constraints. */
  validateAssignment(
    assignments: SlotAssignment[],
    usageHistory: QuestionUsageHistory[],
  ): ConstraintResult {
    const violations: ConstraintViolation[] = [];

    // -- Module range --
    for (const a of assignments) {
      if (!this.config.moduleRange.includes(a.slot.moduleNumber)) {
        violations.push({
          rule: "MODULE_RANGE",
          message: `Question ${a.question.id} assigned to M${a.slot.moduleNumber} which is outside exam range.`,
        });
      }
    }

    // -- Marks match --
    for (const a of assignments) {
      if (a.question.marks !== a.slot.marks) {
        violations.push({
          rule: "MARKS_MISMATCH",
          message: `Question ${a.question.id} (${a.question.marks}m) assigned to ${a.slot.marks}-mark slot.`,
        });
      }
    }

    // -- Module match --
    for (const a of assignments) {
      if (a.question.moduleNumber !== a.slot.moduleNumber) {
        violations.push({
          rule: "MODULE_MISMATCH",
          message: `Question ${a.question.id} (M${a.question.moduleNumber}) assigned to M${a.slot.moduleNumber} slot.`,
        });
      }
    }

    // -- Status --
    for (const a of assignments) {
      if (a.question.status !== QuestionStatus.APPROVED) {
        violations.push({
          rule: "QUESTION_STATUS",
          message: `Question ${a.question.id} has status ${a.question.status}, expected APPROVED.`,
        });
      }
    }

    // -- Duplicate questions --
    const questionIds = new Set<string>();
    for (const a of assignments) {
      if (questionIds.has(a.question.id)) {
        violations.push({
          rule: "DUPLICATE_QUESTION",
          message: `Question ${a.question.id} appears more than once in the paper.`,
        });
      }
      questionIds.add(a.question.id);
    }

    // -- Duplicate concept groups --
    if (this.config.enforceConceptDiversity) {
      const conceptGroups = new Set<string>();
      for (const a of assignments) {
        const cg = a.question.teachingIndex;
        if (cg && conceptGroups.has(cg)) {
          violations.push({
            rule: "DUPLICATE_CONCEPT_GROUP",
            message: `TeachingIndex "${cg}" appears more than once (question ${a.question.id}).`,
          });
        }
        if (cg) conceptGroups.add(cg);
      }
    }

    // -- Usage history --
    if (this.config.enforceUsageHistory) {
      const usedIds = new Set(usageHistory.map((u) => u.questionId));
      for (const a of assignments) {
        if (usedIds.has(a.question.id)) {
          violations.push({
            rule: "QUESTION_ALREADY_USED",
            message: `Question ${a.question.id} was used in a previous exam cycle.`,
          });
        }
      }
    }

    return { valid: violations.length === 0, violations };
  }
}

export function slotKey(module: number, marks: number): string {
  return `${module}-${marks}`;
}
