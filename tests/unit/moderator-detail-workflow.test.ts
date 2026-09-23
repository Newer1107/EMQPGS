import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { RevisionDiff } from "@/components/moderator/revision-diff";
import ModeratorQuestionDetailPage from "../../app/(protected)/dashboard/moderator/questions/[id]/page";

vi.mock("@/lib/db", () => ({ prisma: { questionLibraryItem: { findUnique: vi.fn() }, questionRevision: { findMany: vi.fn() } } }));
vi.mock("@/lib/auth/get-workspace-context", () => ({ getWorkspaceContext: async () => ({ context: { bankId: "bank" } }) }));
vi.mock("@/modules/moderation/service", () => ({ ModeratorService: class { listQuestions = async () => []; } }));
vi.mock("@/components/forms/moderator-actions", () => ({ ModeratorActions: () => null }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));

describe("moderator revision and downstream context", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(prisma.questionRevision.findMany).mockResolvedValue([]); });
  it("shows changed revision fields and keeps old/new selectors chronological", () => {
    const base = { snapshotModule: 1, snapshotMarks: 5, snapshotCo: "CO1", snapshotRbt: "REMEMBER", snapshotDifficulty: null, snapshotTeachingIndex: null, changedBy: { name: "Author" }, createdAt: "2026-01-01T00:00:00Z" };
    const html = renderToStaticMarkup(createElement(RevisionDiff, { revisions: [
      { ...base, id: "r1", revisionNumber: 1, snapshotQuestionText: "Before" },
      { ...base, id: "r2", revisionNumber: 2, snapshotQuestionText: "After", snapshotMarks: 10 },
    ] }));
    expect(html).toContain("Before");
    expect(html).toContain("After");
    expect(html).toContain("Author");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
  it("rejects a question outside the active bank", async () => {
    vi.mocked(prisma.questionLibraryItem.findUnique).mockResolvedValue({ slotAssignments: [{ questionBankId: "other" }] } as never);
    await expect(ModeratorQuestionDetailPage({ params: Promise.resolve({ id: "q" }) })).rejects.toThrow("NOT_FOUND");
  });
  it("renders linked bank phase, lock state and recorded downstream counts", async () => {
    vi.mocked(prisma.questionLibraryItem.findUnique).mockResolvedValue({
      id: "q", moduleNumber: 1, marks: 5, questionText: "Question", coMapping: "CO1", rbtLevel: "REMEMBER", status: "REVISION_SUBMITTED",
      subjectVersion: { subject: { subjectCode: "M1", subjectName: "Math", department: { name: "Science" } } }, creator: { name: "Author" }, owner: { name: "Owner" }, moderationEvents: [],
      slotAssignments: [{ id: "slot", questionBankId: "bank", moduleNumber: 1, marks: 5, slotNumber: 2,
        questionBank: { subject: { subjectCode: "M1" }, phase: "MODERATION", recordStatus: "LOCKED", _count: { generatedPapers: 3, exportArtifacts: 2 }, batchSemester: { semesterNumber: 1, academicYear: { code: "2026" }, batch: { name: "Batch A" } } } }],
    } as never);
    const html = renderToStaticMarkup(await ModeratorQuestionDetailPage({ params: Promise.resolve({ id: "q" }) }));
    expect(html).toContain("MODERATION · LOCKED");
    expect(html).toContain("3 generated papers · 2 exports");
    expect(html).toContain("Batch A");
  });
});
