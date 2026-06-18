import { describe, it, expect, vi } from "vitest";
import { SubjectManagementService } from "@/modules/coordinator/subject.service";
import { Role } from "@prisma/client";

const mockActor = { id: "user-1", role: Role.COORDINATOR, email: "coord@test.com", name: "Coordinator" };

vi.mock("@/lib/db", () => ({
  prisma: {
    department: { findUnique: vi.fn() },
    academicYear: { findFirst: vi.fn() },
    subject: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    subjectVersion: { create: vi.fn(), findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/modules/subject-versions/service", () => ({
  SubjectVersionService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("@/lib/errors", () => ({
  AppError: class AppError extends Error { constructor(message: string, public statusCode: number) { super(message); } },
  ForbiddenError: class ForbiddenError extends Error { statusCode = 403; },
  NotFoundError: class NotFoundError extends Error { statusCode = 404; },
}));

vi.mock("@/lib/db-helpers", () => ({
  withUniqueCheck: (fn: () => Promise<any>) => fn(),
}));

vi.mock("@/modules/coordinator/department-utils", () => ({
  DepartmentAccessUtils: vi.fn().mockImplementation(() => ({
    assertDepartmentAccess: vi.fn(),
    getAssignedDepartmentIds: () => Promise.resolve(["dept-1"]),
  })),
}));

vi.mock("@prisma/client", () => ({
  SubjectStatus: { ACTIVE: "ACTIVE", INACTIVE: "INACTIVE" },
  Role: { COORDINATOR: "COORDINATOR", COE: "COE" },
}));

describe("SubjectManagementService.createSubject", () => {
  it("throws when no active academic year exists", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.department.findUnique).mockResolvedValue({ id: "dept-1" } as any);
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue(null);

    const service = new SubjectManagementService();
    await expect(
      service.createSubject(mockActor, {
        subjectCode: "CS201",
        subjectName: "Data Structures",
        departmentId: "dept-1",
        creditLoad: 4,
      }),
    ).rejects.toThrow("No active academic year found");
  });

  it("succeeds when active academic year exists", async () => {
    const { prisma } = await import("@/lib/db");
    vi.mocked(prisma.department.findUnique).mockResolvedValue({ id: "dept-1" } as any);
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: "ay-1" } as any);
    vi.mocked(prisma.subject.create).mockResolvedValue({ id: "sub-1" } as any);
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => cb(prisma));

    const service = new SubjectManagementService();
    const result = await service.createSubject(mockActor, {
      subjectCode: "CS201",
      subjectName: "Data Structures",
      departmentId: "dept-1",
      creditLoad: 4,
    });
    expect(result).toEqual({ id: "sub-1" });
  });
});
