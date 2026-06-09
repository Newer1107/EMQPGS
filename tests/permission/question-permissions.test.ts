import { QuestionStatus, Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { canEditQuestion, canModerateQuestion, canViewQuestion } from "@/modules/questions/permissions";

const question = {
  contributorId: "contributor-1",
  status: QuestionStatus.DRAFT,
};

describe("question permissions", () => {
  it("limits contributors to their own questions", () => {
    expect(canViewQuestion({ id: "contributor-1", role: Role.CONTRIBUTOR }, question)).toBe(true);
    expect(canViewQuestion({ id: "contributor-2", role: Role.CONTRIBUTOR }, question)).toBe(false);
  });

  it("allows moderators to view and edit all questions", () => {
    expect(canViewQuestion({ id: "moderator-1", role: Role.MODERATOR }, question)).toBe(true);
    expect(canEditQuestion({ id: "moderator-1", role: Role.MODERATOR }, question)).toBe(true);
    expect(canModerateQuestion({ role: Role.MODERATOR })).toBe(true);
  });

  it("keeps coordinators read-only", () => {
    expect(canViewQuestion({ id: "coordinator-1", role: Role.COORDINATOR }, question)).toBe(true);
    expect(canEditQuestion({ id: "coordinator-1", role: Role.COORDINATOR }, question)).toBe(false);
  });
});
