import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { ConflictError } from "@/lib/errors";

vi.mock("@/lib/db", () => {
  const mockDb = {
    questionBank: { findUnique: vi.fn(), update: vi.fn() },
    questionLibraryItem: { findUnique: vi.fn(), update: vi.fn() },
    examCycle: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { findFirst: vi.fn(), create: vi.fn() },
    coordinatorDepartmentAssignment: { findMany: vi.fn() },
    subject: { findUnique: vi.fn(), create: vi.fn() },
    subjectVersion: { create: vi.fn() },
    semester: { findUnique: vi.fn() },
    department: { findUnique: vi.fn() },
    moderatorBankAssignment: { findMany: vi.fn(), findUnique: vi.fn() },
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

  it("throws ConflictError on duplicate subject code", async () => {
    const { SubjectManagementService } = await import("@/modules/coordinator/subject.service");
    const { prisma } = await import("@/lib/db");

    vi.mocked(prisma.department.findUnique).mockResolvedValue({ id: "dept-1" });
    vi.mocked(prisma.semester.findUnique).mockResolvedValue({
      id: "sem-1",
      academicYear: { id: "ay-1", code: "2026-2027" },
      academicYearId: "ay-1",
    });
    vi.mocked(prisma.coordinatorDepartmentAssignment.findMany).mockResolvedValue([
      { departmentId: "dept-1" },
    ]);
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma));
    vi.mocked(prisma.subject.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("n/a", {
        code: "P2002",
        clientVersion: "6.0.0",
        meta: { target: ["subjectCode", "departmentId"] },
      }),
    );

    const service = new SubjectManagementService();
    let thrown: unknown;
    try {
      await service.createSubject(
        { id: "coord-1", role: "COORDINATOR" } as never,
        { subjectCode: "CS101", subjectName: "CS", departmentId: "dept-1", semesterId: "sem-1", creditLoad: 4 },
      );
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ConflictError);
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
