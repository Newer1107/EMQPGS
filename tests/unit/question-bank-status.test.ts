import { describe, it, expect } from "vitest";
import { QuestionBankStatus } from "@prisma/client";
import { isValidTransition } from "@/modules/question-banks/transitions";
import { QuestionBankService } from "@/modules/question-banks/service";
import { AppError, NotFoundError } from "@/lib/errors";

describe("QuestionBankStateTransitions (C3)", () => {
  // ----- Valid transitions -----

  it("DRAFT → IN_PROGRESS is valid", () => {
    expect(isValidTransition(QuestionBankStatus.DRAFT, QuestionBankStatus.IN_PROGRESS)).toBe(true);
  });

  it("DRAFT → LOCKED is valid (emergency fast-lock)", () => {
    expect(isValidTransition(QuestionBankStatus.DRAFT, QuestionBankStatus.LOCKED)).toBe(true);
  });

  it("IN_PROGRESS → UNDER_MODERATION is valid", () => {
    expect(isValidTransition(QuestionBankStatus.IN_PROGRESS, QuestionBankStatus.UNDER_MODERATION)).toBe(true);
  });

  it("UNDER_MODERATION → MODERATED is valid", () => {
    expect(isValidTransition(QuestionBankStatus.UNDER_MODERATION, QuestionBankStatus.MODERATED)).toBe(true);
  });

  it("MODERATED → REPORT_GENERATED is valid", () => {
    expect(isValidTransition(QuestionBankStatus.MODERATED, QuestionBankStatus.REPORT_GENERATED)).toBe(true);
  });

  it("REPORT_GENERATED → AWAITING_HOD_SIGN is valid", () => {
    expect(isValidTransition(QuestionBankStatus.REPORT_GENERATED, QuestionBankStatus.AWAITING_HOD_SIGN)).toBe(true);
  });

  it("AWAITING_HOD_SIGN → SIGNED_REPORT_UPLOADED is valid", () => {
    expect(isValidTransition(QuestionBankStatus.AWAITING_HOD_SIGN, QuestionBankStatus.SIGNED_REPORT_UPLOADED)).toBe(true);
  });

  it("SIGNED_REPORT_UPLOADED → AWAITING_COORDINATOR_APPROVAL is valid", () => {
    expect(isValidTransition(QuestionBankStatus.SIGNED_REPORT_UPLOADED, QuestionBankStatus.AWAITING_COORDINATOR_APPROVAL)).toBe(true);
  });

  it("AWAITING_COORDINATOR_APPROVAL → APPROVED is valid", () => {
    expect(isValidTransition(QuestionBankStatus.AWAITING_COORDINATOR_APPROVAL, QuestionBankStatus.APPROVED)).toBe(true);
  });

  it("AWAITING_COORDINATOR_APPROVAL → AWAITING_HOD_SIGN is valid (coordinator sends back)", () => {
    expect(isValidTransition(QuestionBankStatus.AWAITING_COORDINATOR_APPROVAL, QuestionBankStatus.AWAITING_HOD_SIGN)).toBe(true);
  });

  it("APPROVED → LOCKED is valid", () => {
    expect(isValidTransition(QuestionBankStatus.APPROVED, QuestionBankStatus.LOCKED)).toBe(true);
  });

  // Every non-LOCKED state can transition to LOCKED
  it.each([
    QuestionBankStatus.DRAFT,
    QuestionBankStatus.IN_PROGRESS,
    QuestionBankStatus.UNDER_MODERATION,
    QuestionBankStatus.MODERATED,
    QuestionBankStatus.REPORT_GENERATED,
    QuestionBankStatus.AWAITING_HOD_SIGN,
    QuestionBankStatus.SIGNED_REPORT_UPLOADED,
    QuestionBankStatus.AWAITING_COORDINATOR_APPROVAL,
    QuestionBankStatus.APPROVED,
  ])("any status except LOCKED can transition to LOCKED: %s", (status) => {
    expect(isValidTransition(status, QuestionBankStatus.LOCKED)).toBe(true);
  });

  // ----- Invalid transitions -----

  it("LOCKED can only transition to DRAFT or IN_PROGRESS (unlock)", () => {
    for (const status of Object.values(QuestionBankStatus)) {
      if (status === QuestionBankStatus.LOCKED) continue;
      const expected = status === QuestionBankStatus.DRAFT || status === QuestionBankStatus.IN_PROGRESS;
      expect(isValidTransition(QuestionBankStatus.LOCKED, status)).toBe(expected);
    }
  });

  it("IN_PROGRESS → APPROVED is invalid (skips moderation)", () => {
    expect(isValidTransition(QuestionBankStatus.IN_PROGRESS, QuestionBankStatus.APPROVED)).toBe(false);
  });

  it("DRAFT → MODERATED is invalid (skips IN_PROGRESS)", () => {
    expect(isValidTransition(QuestionBankStatus.DRAFT, QuestionBankStatus.MODERATED)).toBe(false);
  });

  it("DRAFT → REPORT_GENERATED is invalid (skips 3 states)", () => {
    expect(isValidTransition(QuestionBankStatus.DRAFT, QuestionBankStatus.REPORT_GENERATED)).toBe(false);
  });

  it("DRAFT → AWAITING_HOD_SIGN is invalid (skips 4 states)", () => {
    expect(isValidTransition(QuestionBankStatus.DRAFT, QuestionBankStatus.AWAITING_HOD_SIGN)).toBe(false);
  });

  it("MODERATED → UNDER_MODERATION is invalid (cannot go backward)", () => {
    expect(isValidTransition(QuestionBankStatus.MODERATED, QuestionBankStatus.UNDER_MODERATION)).toBe(false);
  });

  it("APPROVED → AWAITING_HOD_SIGN is invalid (already approved)", () => {
    expect(isValidTransition(QuestionBankStatus.APPROVED, QuestionBankStatus.AWAITING_HOD_SIGN)).toBe(false);
  });

  it("LOCKED → IN_PROGRESS is valid (unlock)", () => {
    expect(isValidTransition(QuestionBankStatus.LOCKED, QuestionBankStatus.IN_PROGRESS)).toBe(true);
  });

  it("LOCKED → DRAFT is valid (unlock to draft)", () => {
    expect(isValidTransition(QuestionBankStatus.LOCKED, QuestionBankStatus.DRAFT)).toBe(true);
  });

  // ----- Service-level enforcement -----

  it("updateStatus throws AppError with 409 for invalid transition", async () => {
    const mockRepo = { findById: () => Promise.resolve({ status: QuestionBankStatus.DRAFT }), update: () => Promise.resolve({}) };
    const service = new QuestionBankService(mockRepo as any, {} as any);

    await expect(
      service.updateStatus("bank-1", QuestionBankStatus.REPORT_GENERATED),
    ).rejects.toThrow(AppError);
  });

  it("updateStatus throws 404 for missing bank", async () => {
    const mockRepo = { findById: () => Promise.resolve(null), update: () => Promise.resolve({}) };
    const service = new QuestionBankService(mockRepo as any, {} as any);

    await expect(
      service.updateStatus("bank-missing", QuestionBankStatus.LOCKED),
    ).rejects.toThrow(NotFoundError);
  });

  it("updateStatus succeeds for valid transition", async () => {
    const mockRepo = { findById: () => Promise.resolve({ status: QuestionBankStatus.APPROVED }), update: () => Promise.resolve({ id: "bank-1", status: QuestionBankStatus.LOCKED }) };
    const service = new QuestionBankService(mockRepo as any, {} as any);

    const result = await service.updateStatus("bank-1", QuestionBankStatus.LOCKED);
    expect(result).toHaveProperty("id", "bank-1");
    expect(result).toHaveProperty("status", QuestionBankStatus.LOCKED);
  });
});
