import { describe, it, expect, vi } from "vitest";
import { QuestionBankPhase } from "@prisma/client";
import { isValidPhaseTransition } from "@/modules/question-banks/transitions";
import { QuestionBankService } from "@/modules/question-banks/service";

describe("isValidPhaseTransition", () => {
  it("DRAFTING → MODERATION is valid", () => {
    expect(isValidPhaseTransition(QuestionBankPhase.DRAFTING, QuestionBankPhase.MODERATION)).toBe(true);
  });

  it("MODERATION → APPROVAL is valid", () => {
    expect(isValidPhaseTransition(QuestionBankPhase.MODERATION, QuestionBankPhase.APPROVAL)).toBe(true);
  });

  it("APPROVAL → COMPLETE is valid", () => {
    expect(isValidPhaseTransition(QuestionBankPhase.APPROVAL, QuestionBankPhase.COMPLETE)).toBe(true);
  });

  it("APPROVAL → MODERATION is valid (loopback on reject)", () => {
    expect(isValidPhaseTransition(QuestionBankPhase.APPROVAL, QuestionBankPhase.MODERATION)).toBe(true);
  });

  it("COMPLETE → MODERATION is invalid", () => {
    expect(isValidPhaseTransition(QuestionBankPhase.COMPLETE, QuestionBankPhase.MODERATION)).toBe(false);
  });

  it("DRAFTING → COMPLETE is invalid (skips phases)", () => {
    expect(isValidPhaseTransition(QuestionBankPhase.DRAFTING, QuestionBankPhase.COMPLETE)).toBe(false);
  });

  it("MODERATION → DRAFTING is invalid (no reverse)", () => {
    expect(isValidPhaseTransition(QuestionBankPhase.MODERATION, QuestionBankPhase.DRAFTING)).toBe(false);
  });
});

describe("QuestionBankService.advancePhase", () => {
  it("advances from DRAFTING to MODERATION", async () => {
    const mockRepo = {
      findById: () => Promise.resolve({ phase: QuestionBankPhase.DRAFTING, version: 1 }),
      update: () => Promise.resolve({ id: "bank-1", phase: QuestionBankPhase.MODERATION }),
    };
    const service = new QuestionBankService(mockRepo as any);
    const result = await service.advancePhase("bank-1", QuestionBankPhase.MODERATION);
    expect(result).toHaveProperty("phase", QuestionBankPhase.MODERATION);
  });

  it("throws on invalid transition", async () => {
    const mockRepo = {
      findById: () => Promise.resolve({ phase: QuestionBankPhase.DRAFTING, version: 1 }),
      update: () => Promise.resolve({}),
    };
    const service = new QuestionBankService(mockRepo as any);
    await expect(service.advancePhase("bank-1", QuestionBankPhase.COMPLETE)).rejects.toThrow();
  });

  it("throws when bank not found", async () => {
    const mockRepo = {
      findById: () => Promise.resolve(null),
      update: () => Promise.resolve({}),
    };
    const service = new QuestionBankService(mockRepo as any);
    await expect(service.advancePhase("bank-missing", QuestionBankPhase.MODERATION)).rejects.toThrow();
  });
});
