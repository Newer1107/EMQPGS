import { QuestionStatus, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError, ForbiddenError } from "@/lib/errors";
import { QuestionService } from "@/modules/questions/service";

const mockLogAudit = vi.fn();
const mockQuestionRepository = {
  findSlotById: vi.fn(),
  createQuestion: vi.fn(),
  findById: vi.fn(),
  updateQuestion: vi.fn(),
  listSlots: vi.fn(),
};
const mockNotificationService = {
  createAndEmail: vi.fn(),
};
const mockStorageService = {
  createUploadLink: vi.fn(),
};

vi.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    questionBank: {
      findUnique: vi.fn(),
    },
    question: {
      update: vi.fn(),
    },
    questionRevision: {
      count: vi.fn(),
      create: vi.fn(),
    },
    moderatorBankAssignment: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    coordinatorDepartmentAssignment: {
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    questionSlot: {
      update: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

describe("QuestionService integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a question only for an owned reserved slot", async () => {
    const service = new QuestionService(
      mockQuestionRepository as never,
      mockNotificationService as never,
      mockStorageService as never,
    );

    mockQuestionRepository.findSlotById.mockResolvedValue({
      id: "slot-1",
      questionBankId: "qb-1",
      moduleNumber: 3,
      marks: 5,
      slotNumber: 4,
      reservedById: "user-1",
      questionBank: { status: "IN_PROGRESS" },
      question: null,
    });
    mockQuestionRepository.createQuestion.mockResolvedValue({ id: "q-1" });

    const result = await service.createQuestion(
      {
        slotId: "slot-1",
        questionText: "Explain why AVL rotations preserve the binary search property.",
        coMapping: "CO3",
        rbtLevel: "L3",
        teachingIndex: "TI-01",
        difficultyLevel: "MEDIUM",
      },
      {
        id: "user-1",
        role: Role.CONTRIBUTOR,
        email: "contributor@example.com",
        name: "Contributor",
      },
    );

    expect(result).toEqual({ id: "q-1" });
    expect(mockQuestionRepository.createQuestion).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalled();
  });

  it("blocks contributors from creating a question in another user's slot", async () => {
    const service = new QuestionService(
      mockQuestionRepository as never,
      mockNotificationService as never,
      mockStorageService as never,
    );

    mockQuestionRepository.findSlotById.mockResolvedValue({
      id: "slot-1",
      questionBankId: "qb-1",
      moduleNumber: 3,
      marks: 5,
      slotNumber: 4,
      reservedById: "user-2",
      questionBank: { status: "IN_PROGRESS" },
      question: null,
    });

    await expect(
      service.createQuestion(
        {
          slotId: "slot-1",
          questionText: "Explain why AVL rotations preserve the binary search property.",
          coMapping: "CO3",
          rbtLevel: "L3",
          teachingIndex: "TI-01",
          difficultyLevel: "MEDIUM",
        },
        {
          id: "user-1",
          role: Role.CONTRIBUTOR,
          email: "contributor@example.com",
          name: "Contributor",
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("submits a question and rejects too-short content", async () => {
    const { prisma } = await import("@/lib/db");
    const service = new QuestionService(
      mockQuestionRepository as never,
      mockNotificationService as never,
      mockStorageService as never,
    );

    mockQuestionRepository.findById.mockResolvedValueOnce({
      id: "q-1",
      contributorId: "user-1",
      questionText: "short",
      questionBank: { status: "IN_PROGRESS" },
    });

    await expect(
      service.submitQuestion("q-1", {
        id: "user-1",
        role: Role.CONTRIBUTOR,
        email: "contributor@example.com",
        name: "Contributor",
      }),
    ).rejects.toBeInstanceOf(AppError);

    mockQuestionRepository.findById.mockResolvedValueOnce({
      id: "q-1",
      contributorId: "user-1",
      questionText: "Describe the amortized complexity of Fibonacci heap decrease-key operation.",
      status: QuestionStatus.DRAFT,
      moduleNumber: 2,
      marks: 10,
      slotNumber: 5,
      moderatorRemark: null,
      questionBank: {
        id: "qb-1",
        status: "IN_PROGRESS",
        subject: { subjectCode: "CS501", subjectName: "Algorithms", departmentId: "dep-1" },
        assignments: [{ assignmentRole: "MODERATOR", teacher: { id: "m-1", email: "mod@example.com", name: "Mod" } }],
      },
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
      callback(prisma as never) as Promise<unknown>,
    );
    vi.mocked(prisma.questionRevision.count).mockResolvedValue(0);
    vi.mocked(prisma.questionRevision.create).mockResolvedValue({ id: "rev-1" } as never);
    vi.mocked(prisma.question.update).mockResolvedValue({
      id: "q-1",
      questionBankId: "qb-1",
      contributor: { id: "user-1", name: "Contributor", email: "contributor@example.com" },
      status: QuestionStatus.PENDING,
      moduleNumber: 2,
      marks: 10,
      slotNumber: 5,
      submittedAt: new Date(),
      questionBank: {
        subject: { subjectCode: "CS501", subjectName: "Algorithms", departmentId: "dep-1" },
        assignments: [{ assignmentRole: "MODERATOR", teacher: { id: "m-1", email: "mod@example.com", name: "Mod" } }],
      },
    } as never);
    vi.mocked(prisma.moderatorBankAssignment.findMany).mockResolvedValue([
      { moderator: { id: "m-1", email: "mod@example.com", name: "Mod" } },
    ] as never);
    vi.mocked(prisma.coordinatorDepartmentAssignment.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await service.submitQuestion("q-1", {
      id: "user-1",
      role: Role.CONTRIBUTOR,
      email: "contributor@example.com",
      name: "Contributor",
    });

    expect(result).toMatchObject({ id: "q-1", status: QuestionStatus.PENDING });
    expect(mockNotificationService.createAndEmail).toHaveBeenCalled();
  });
});
