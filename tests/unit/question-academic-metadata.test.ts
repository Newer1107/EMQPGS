import { describe, expect, it } from "vitest";
import { questionLibraryItemSchema, questionLibraryUpdateSchema } from "@/modules/question-library/validation";
const input = { subjectVersionId: "v", moduleNumber: 1, marks: 5, questionText: "Explain the principle of conservation of energy.", coMapping: "CO1", rbtLevel: "L2" };
describe("explicit academic metadata", () => {
  it("preserves unknown data for existing questions", () => {
    const result = questionLibraryItemSchema.parse(input);
    expect(result.questionType).toBeUndefined();
    expect(result.poMapping).toBeUndefined();
  });
  it("accepts real type and mapping declarations", () => {
    const result = questionLibraryItemSchema.parse({ ...input, questionType: "NUMERICAL", poMapping: ["PO1"], piMapping: ["PI1.1"] });
    expect(result.questionType).toBe("NUMERICAL");
    expect(result.piMapping).toEqual(["PI1.1"]);
  });
  it("rejects unsupported types and duplicate mappings", () => {
    expect(questionLibraryItemSchema.safeParse({ ...input, questionType: "essay" }).success).toBe(false);
    expect(questionLibraryItemSchema.safeParse({ ...input, poMapping: ["PO1", "PO1"] }).success).toBe(false);
  });
  it("allows clearing a declared value without inventing replacement data", () => {
    expect(questionLibraryUpdateSchema.parse({ questionType: "", piMapping: [] })).toEqual({ questionType: null, piMapping: [] });
  });
});
