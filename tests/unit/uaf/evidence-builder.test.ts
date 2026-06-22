import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundError } from "@/lib/errors";

vi.mock("@/lib/db", () => {
  const mockPrisma = {
    questionBank: {
      findUnique: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

import { prisma } from "@/lib/db";
import { EvidenceBuilder } from "@/lib/uaf/evidence-builder";
import type { RawBankData } from "@/lib/uaf/types";

// ── Fixtures ─────────────────────────────────────

const baseSlot = {
  id: "slot-1",
  questionBankId: "qb-1",
  moduleNumber: 1,
  marks: 5,
  slotNumber: 1,
  assignedQuestionId: "q-1",
  reservedById: null,
  reservedAt: null,
  isLocked: false,
};

const baseQuestion = {
  questionText: "Explain the concept of inheritance in OOP.",
  marks: 5,
  coMapping: "CO1" as const,
  rbtLevel: "L2" as const,
  difficultyLevel: "MEDIUM" as const,
  moduleNumber: 1,
};

function mockBank(overrides: Record<string, unknown> = {}) {
  return {
    id: "qb-1",
    subjectId: "sub-1",
    batchSemesterId: "bs-1",
    academicYearId: "ay-1",
    phase: "APPROVAL",
    recordStatus: "ACTIVE",
    version: 1,
    createdById: "user-1",
    lockedAt: null,
    lockedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    subject: { name: "Advanced Algorithms", code: "CS501" },
    slots: [
      { ...baseSlot, assignedQuestion: { ...baseQuestion } },
      {
        ...baseSlot, id: "slot-2", slotNumber: 2, moduleNumber: 2, marks: 10,
        assignedQuestion: {
          ...baseQuestion, questionText: "Design a sorting algorithm.", marks: 10, moduleNumber: 2, coMapping: "CO2",
        },
      },
      {
        ...baseSlot, id: "slot-3", slotNumber: 3, moduleNumber: 3, marks: 2,
        assignedQuestion: {
          ...baseQuestion, questionText: "Define时间复杂度.", marks: 2, moduleNumber: 3, coMapping: "CO3", rbtLevel: "L1",
        },
      },
      // Empty slot (no assigned question)
      { ...baseSlot, id: "slot-4", slotNumber: 4, assignedQuestionId: null, assignedQuestion: null },
    ],
    ...overrides,
  };
}

function mockBankNoData(overrides: Record<string, unknown> = {}) {
  return {
    id: "qb-1",
    subjectId: "sub-1",
    batchSemesterId: "bs-1",
    academicYearId: "ay-1",
    phase: "DRAFTING",
    recordStatus: "ACTIVE",
    version: 1,
    createdById: "user-1",
    lockedAt: null,
    lockedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    subject: { name: "Subject", code: "SUB" },
    slots: [
      {
        ...baseSlot, id: "slot-1", assignedQuestion: {
          ...baseQuestion,
          coMapping: null,
          rbtLevel: null,
          difficultyLevel: null,
        },
      },
    ],
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────

describe("EvidenceBuilder", () => {
  let builder: EvidenceBuilder;

  beforeEach(() => {
    vi.clearAllMocks();
    builder = new EvidenceBuilder();
  });

  describe("collect()", () => {
    it("returns correct RawBankData shape from a populated bank", async () => {
      (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockBank());

      const result = await builder.collect("qb-1");

      // Shape check
      expect(result).toHaveProperty("questionBankId", "qb-1");
      expect(result).toHaveProperty("subjectName", "Advanced Algorithms");
      expect(result).toHaveProperty("subjectCode", "CS501");
      expect(result).toHaveProperty("totalSlots", 4);
      expect(result).toHaveProperty("filledSlots", 3);
      expect(result).toHaveProperty("totalMarks", 17); // 5 + 10 + 2
      expect(result).toHaveProperty("extractionTimestamp");
      expect(typeof result.extractionTimestamp).toBe("string");

      // Questions array
      expect(result.questions).toHaveLength(3);
      expect(result.questions[0]).toHaveProperty("questionIndex", 1);
      expect(result.questions[0]).toHaveProperty("questionText", "Explain the concept of inheritance in OOP.");
      expect(result.questions[0]).toHaveProperty("marks", 5);
      expect(result.questions[0]).toHaveProperty("moduleNumber", 1);
      expect(result.questions[0]).toHaveProperty("coMapping", "CO1");
      expect(result.questions[0]).toHaveProperty("rbtLevel", "L2");
      expect(result.questions[0]).toHaveProperty("difficultyLevel", "MEDIUM");
      expect(result.questions[0]).toHaveProperty("questionType", null);
      expect(result.questions[0]).toHaveProperty("commandVerb", "explain");

      // Status fields
      expect(result.questions[0]).toHaveProperty("coStatus", "VERIFIED");
      expect(result.questions[0]).toHaveProperty("rbtStatus", "VERIFIED");
      expect(result.questions[0]).toHaveProperty("difficultyStatus", "VERIFIED");
    });

    it("extracts questions only from filled slots", async () => {
      const bank = mockBank();
      bank.slots.push(
        { ...baseSlot, id: "slot-empty", assignedQuestionId: null, assignedQuestion: null },
        { ...baseSlot, id: "slot-empty-2", assignedQuestionId: null, assignedQuestion: null },
      );
      (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(bank);

      const result = await builder.collect("qb-1");

      expect(result.totalSlots).toBe(6);
      expect(result.filledSlots).toBe(3);
      expect(result.questions).toHaveLength(3);
    });

    it("computes module summaries correctly", async () => {
      (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockBank());

      const result = await builder.collect("qb-1");

      expect(result.modules).toHaveLength(3);
      expect(result.modules[0]).toEqual({
        moduleNumber: 1,
        totalQuestions: 1,
        totalMarks: 5,
        coveredCOs: ["CO1"],
      });
      expect(result.modules[1]).toEqual({
        moduleNumber: 2,
        totalQuestions: 1,
        totalMarks: 10,
        coveredCOs: ["CO2"],
      });
      expect(result.modules[2]).toEqual({
        moduleNumber: 3,
        totalQuestions: 1,
        totalMarks: 2,
        coveredCOs: ["CO3"],
      });
    });

    it("aggregates multiple COs per module", async () => {
      const bank = mockBank();
      bank.slots.push({
        ...baseSlot, id: "slot-extra", slotNumber: 5, moduleNumber: 1, marks: 2,
        assignedQuestion: { ...baseQuestion, questionText: "List sorting types.", marks: 2, moduleNumber: 1, coMapping: "CO2" },
      });
      (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(bank);

      const result = await builder.collect("qb-1");

      const mod1 = result.modules.find((m) => m.moduleNumber === 1)!;
      expect(mod1.totalQuestions).toBe(2);
      expect(mod1.totalMarks).toBe(7); // 5 + 2
      expect(mod1.coveredCOs).toEqual(["CO1", "CO2"]);
    });

    it("sorts modules by moduleNumber", async () => {
      const bank = mockBank();
      bank.slots = [
        { ...baseSlot, id: "s3", slotNumber: 3, moduleNumber: 3, marks: 2, assignedQuestion: { ...baseQuestion, questionText: "Q3", marks: 2, moduleNumber: 3 } },
        { ...baseSlot, id: "s1", slotNumber: 1, moduleNumber: 1, marks: 5, assignedQuestion: { ...baseQuestion, questionText: "Q1", marks: 5, moduleNumber: 1 } },
        { ...baseSlot, id: "s2", slotNumber: 2, moduleNumber: 2, marks: 10, assignedQuestion: { ...baseQuestion, questionText: "Q2", marks: 10, moduleNumber: 2 } },
      ];
      (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(bank);

      const result = await builder.collect("qb-1");

      expect(result.modules.map((m) => m.moduleNumber)).toEqual([1, 2, 3]);
    });

    it("sets MISSING_DATA status when fields are null", async () => {
      (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockBankNoData());

      const result = await builder.collect("qb-null");

      expect(result.questions[0].coMapping).toBeNull();
      expect(result.questions[0].rbtLevel).toBeNull();
      expect(result.questions[0].difficultyLevel).toBeNull();
      expect(result.questions[0].coStatus).toBe("MISSING_DATA");
      expect(result.questions[0].rbtStatus).toBe("MISSING_DATA");
      expect(result.questions[0].difficultyStatus).toBe("MISSING_DATA");
    });

    it("extracts command verb from question text", async () => {
      const bank = mockBank();
      bank.slots = [
        { ...baseSlot, id: "s1", assignedQuestion: { ...baseQuestion, questionText: "Define the term algorithm." } },
        { ...baseSlot, id: "s2", assignedQuestion: { ...baseQuestion, questionText: "Compare and contrast BFS and DFS.", coMapping: "CO2" } },
        { ...baseSlot, id: "s3", assignedQuestion: { ...baseQuestion, questionText: "A plain statement without a verb.", coMapping: "CO3", rbtLevel: "L3" } },
      ];
      (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(bank);

      const result = await builder.collect("qb-1");

      expect(result.questions[0].commandVerb).toBe("define");
      expect(result.questions[1].commandVerb).toBe("compare");
      expect(result.questions[2].commandVerb).toBeNull();
    });

    it("handles edge case verbs (non-alphabetic prefix)", async () => {
      const bank = mockBank();
      bank.slots = [
        { ...baseSlot, id: "s1", assignedQuestion: { ...baseQuestion, questionText: "(a) Define the term." } },
        { ...baseSlot, id: "s2", assignedQuestion: { ...baseQuestion, questionText: "1. List items.", coMapping: "CO2" } },
      ];
      (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(bank);

      const result = await builder.collect("qb-1");

      // "(a)" → strip non-alpha → "" → null
      expect(result.questions[0].commandVerb).toBeNull();
      // "1." → strip non-alpha → "" → null
      expect(result.questions[1].commandVerb).toBeNull();
    });

    it("throws NotFoundError when bank does not exist", async () => {
      (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(builder.collect("nonexistent")).rejects.toThrow(NotFoundError);
    });

    it("throws with default message when bank not found", async () => {
      (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      try {
        await builder.collect("missing");
        expect.unreachable("Should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(NotFoundError);
        expect((e as NotFoundError).statusCode).toBe(404);
      }
    });

    it("passes through correct Prisma query", async () => {
      (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockBank());

      await builder.collect("qb-1");

      expect(prisma.questionBank.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "qb-1" },
          include: expect.objectContaining({
            subject: expect.anything(),
            slots: expect.objectContaining({
              include: expect.objectContaining({
                assignedQuestion: expect.objectContaining({
                  select: expect.objectContaining({
                    questionText: true,
                    marks: true,
                    coMapping: true,
                    rbtLevel: true,
                    difficultyLevel: true,
                    moduleNumber: true,
                  }),
                }),
              }),
            }),
          }),
        }),
      );
    });

    it("returns empty modules when all slots are empty", async () => {
      const bank = mockBank();
      bank.slots = [
        { ...baseSlot, id: "s1", assignedQuestionId: null, assignedQuestion: null },
        { ...baseSlot, id: "s2", assignedQuestionId: null, assignedQuestion: null },
      ];
      (prisma.questionBank.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(bank);

      const result = await builder.collect("qb-1");

      expect(result.filledSlots).toBe(0);
      expect(result.questions).toHaveLength(0);
      expect(result.modules).toHaveLength(0);
      expect(result.totalMarks).toBe(0);
    });
  });
});
