import { describe, expect, it } from "vitest";
import { buildQuestionSlotTemplate, QUESTION_MARKS, QUESTION_MODULE_COUNT, QUESTION_SLOT_COUNT } from "@/modules/questions/slot-template";

describe("buildQuestionSlotTemplate", () => {
  it("creates the full 126-slot matrix", () => {
    const slots = buildQuestionSlotTemplate();

    expect(slots).toHaveLength(QUESTION_MODULE_COUNT * QUESTION_MARKS.length * QUESTION_SLOT_COUNT);
    expect(slots[0]).toEqual({ moduleNumber: 1, marks: 2, slotNumber: 1 });
    expect(slots.at(-1)).toEqual({ moduleNumber: 6, marks: 10, slotNumber: 7 });
  });

  it("does not create duplicate coordinates", () => {
    const slots = buildQuestionSlotTemplate();
    const keys = new Set(slots.map((slot) => `${slot.moduleNumber}-${slot.marks}-${slot.slotNumber}`));
    expect(keys.size).toBe(slots.length);
  });
});
