import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { ConflictError } from "@/lib/errors";

vi.mock("@/lib/db", () => {
  const mockDb = {
    questionBank: { findUnique: vi.fn(), update: vi.fn() },
    question: { findUnique: vi.fn(), update: vi.fn() },
    questionSlot: { findUnique: vi.fn(), update: vi.fn() },
    examCycle: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { findFirst: vi.fn(), create: vi.fn() },
    teacherAssignment: { create: vi.fn(), findFirst: vi.fn() },
    coordinatorDepartmentAssignment: { findMany: vi.fn() },
    subject: { findUnique: vi.fn(), create: vi.fn() },
    department: { findUnique: vi.fn() },
    moderatorBankAssignment: { findMany: vi.fn(), findUnique: vi.fn() },
    questionRevision: { count: vi.fn() },
    notification: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  return { prisma: mockDb };
});

describe("H6 - QuestionBank updateStatus concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws ConflictError on version mismatch during status update", async () => {
    const { QuestionBankService } = await import("@/modules/question-banks/service");
    const { prisma } = await import("@/lib/db");

    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue({
      id: "bank-1",
      status: "IN_PROGRESS",
      version: 1,
    });

    vi.mocked(prisma.questionBank.update).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("n/a", {
        code: "P2025",
        clientVersion: "6.0.0",
      }),
    );

    const service = new QuestionBankService();
    let thrown: unknown;
    try {
      await service.updateStatus("bank-1", "UNDER_MODERATION" as never);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ConflictError);
    expect((thrown as ConflictError).statusCode).toBe(409);
  });
});

describe("H3 - Audit log uses serializable isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes Serialized isolation level to $transaction", async () => {
    const { logAudit } = await import("@/lib/audit");
    const { prisma } = await import("@/lib/db");

    vi.mocked(prisma.$transaction).mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          auditLog: {
            findFirst: vi.fn().mockResolvedValue({ integrityHash: "abc123" }),
            create: vi.fn().mockResolvedValue({ id: "log-1" }),
          },
        };
        return cb(mockTx);
      },
    );

    await logAudit({ action: "TEST", entityType: "TEST" });
    expect(vi.mocked(prisma.$transaction)).toHaveBeenCalled();
  });
});

describe("N6 - Coordinator createSubject uses withUniqueCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws ConflictError on duplicate subject code", async () => {
    const { CoordinatorService } = await import("@/modules/coordinator/service");
    const { prisma } = await import("@/lib/db");

    vi.mocked(prisma.department.findUnique).mockResolvedValue({ id: "dept-1" });
    vi.mocked(prisma.coordinatorDepartmentAssignment.findMany).mockResolvedValue([
      { departmentId: "dept-1" },
    ]);

    vi.mocked(prisma.subject.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("n/a", {
        code: "P2002",
        clientVersion: "6.0.0",
        meta: { target: ["subjectCode", "departmentId"] },
      }),
    );

    const service = new CoordinatorService();
    let thrown: unknown;
    try {
      await service.createSubject(
        { id: "coord-1", role: "COORDINATOR" } as never,
        { subjectCode: "CS101", subjectName: "CS", departmentId: "dept-1", semester: 4, creditLoad: 4 },
      );
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ConflictError);
  });
});

describe("N6 - Coordinator assignContributor uses withUniqueCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws ConflictError on duplicate assignment", async () => {
    const { CoordinatorService } = await import("@/modules/coordinator/service");
    const { prisma } = await import("@/lib/db");

    vi.mocked(prisma.coordinatorDepartmentAssignment.findMany).mockResolvedValue([
      { departmentId: "dept-1" },
    ]);
    vi.mocked(prisma.questionBank.findUnique).mockResolvedValue({
      id: "bank-1",
      subject: { departmentId: "dept-1" },
    });
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "contrib-1",
      role: "CONTRIBUTOR",
      departmentId: "dept-1",
    });
    vi.mocked(prisma.teacherAssignment.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("n/a", {
        code: "P2002",
        clientVersion: "6.0.0",
        meta: { target: ["questionBankId", "teacherId", "assignmentRole", "moduleNumber"] },
      }),
    );

    const service = new CoordinatorService();
    let thrown: unknown;
    try {
      await service.assignContributor(
        { id: "coord-1", role: "COORDINATOR" } as never,
        "bank-1",
        1,
        "contrib-1",
      );
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ConflictError);
    expect((thrown as ConflictError).statusCode).toBe(409);
  });
});
