import type { QuestionLibraryItem } from "@prisma/client";
import { QuestionStatus } from "@prisma/client";
import type { PaperSlot, SlotAssignment } from "./types";
import { slotKey } from "./constraint-engine";

export type CandidateBuilderConfig = {
  /** Module range for the exam (e.g. [1,2,3] for ISE-1). */
  moduleRange: number[];
  /** Marks pattern per module. Default [2,5,10] for ENDSEM; ISE uses [2,2,5]. */
  marksPattern?: readonly number[];
  /** If true, exclude questions already in usage history. */
  excludeUsed: boolean;
  /** Set of question IDs already used in this generation run. */
  consumedInRun: Set<string>;
};

/**
 * Knows NOTHING about quality scores.
 * Only answers: "which questions are eligible for this slot?"
 */
export class CandidateBuilder {
  constructor(
    private readonly config: CandidateBuilderConfig,
    /** Map of slotKey -> approved questions available for that (module,marks). */
    private readonly inventory: Map<string, QuestionLibraryItem[]>,
  ) {}

  /** Return all eligible candidates for a single slot. */
  candidatesFor(slot: PaperSlot, current: SlotAssignment[]): QuestionLibraryItem[] {
    const key = slotKey(slot.moduleNumber, slot.marks);
    const pool = this.inventory.get(key) ?? [];

    const alreadyPicked = new Set(current.map((a) => a.question.id));

    return pool.filter((q) => {
      // Must be APPROVED
      if (q.status !== QuestionStatus.APPROVED) return false;
      // Not already picked in this paper
      if (alreadyPicked.has(q.id)) return false;
      // Not consumed across variants in this run
      if (this.config.consumedInRun.has(q.id)) return false;
      return true;
    });
  }

  /** Build initial slot list for the config's module range and marks pattern. */
  buildSlots(): PaperSlot[] {
    const slots: PaperSlot[] = [];
    const marksPattern = this.config.marksPattern ?? [2, 5, 10] as const;
    for (const moduleNumber of this.config.moduleRange) {
      for (const marks of marksPattern) {
        slots.push({ moduleNumber, marks, slotNumber: 1 });
      }
    }
    return slots;
  }
}
