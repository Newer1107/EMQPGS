export const QUESTION_MODULE_COUNT = 6;
export const QUESTION_SLOT_COUNT = 7;
export const QUESTION_MARKS = [2, 5, 10] as const;

export type SlotTemplate = {
  moduleNumber: number;
  marks: (typeof QUESTION_MARKS)[number];
  slotNumber: number;
};

export function buildQuestionSlotTemplate(): SlotTemplate[] {
  const slots: SlotTemplate[] = [];

  for (let moduleNumber = 1; moduleNumber <= QUESTION_MODULE_COUNT; moduleNumber += 1) {
    for (const marks of QUESTION_MARKS) {
      for (let slotNumber = 1; slotNumber <= QUESTION_SLOT_COUNT; slotNumber += 1) {
        slots.push({ moduleNumber, marks, slotNumber });
      }
    }
  }

  return slots;
}
