import { Role, SubjectStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { withUniqueCheck } from "@/lib/db-helpers";
import { DepartmentAccessUtils, type Actor } from "@/modules/coordinator/department-utils";
import { SubjectVersionService } from "@/modules/subject-versions/service";

type SubjectPayload = {
  subjectCode: string;
  subjectName: string;
  departmentId: string;
  creditLoad: number;
};

type SubjectUpdatePayload = {
  subjectCode?: string;
  subjectName?: string;
  creditLoad?: number;
};

type SubjectFilters = {
  departmentId?: string;
  status?: SubjectStatus;
};

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export class SubjectManagementService {
  constructor(
    private readonly deptUtils = new DepartmentAccessUtils(),
    private readonly versionService = new SubjectVersionService(),
  ) {}

  async listSubjects(actor: Actor, filters: SubjectFilters = {}) {
    const departmentIds = await this.deptUtils.getAssignedDepartmentIds(actor);
    if (filters.departmentId && !departmentIds.includes(filters.departmentId)) {
      throw new ForbiddenError("You do not have access to that department.");
    }

    return prisma.subject.findMany({
      where: {
        departmentId: { in: departmentIds },
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      select: {
        id: true,
        subjectCode: true,
        subjectName: true,
        credits: true,
        status: true,
        questionBankDueDate: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true, code: true } },
        versions: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            versionNumber: true,
            title: true,
            syllabusDescription: true,
            effectiveFromAcademicYear: { select: { id: true, code: true } },
          },
          take: 1,
        },
        examCycleLinks: {
          select: {
            id: true,
            examCycleId: true,
            examCycle: { select: { id: true, examType: true, status: true, batchSemester: { select: { semesterNumber: true, academicYear: { select: { id: true, code: true } } } } } },
          },
        },
        curriculumSubjects: {
          select: { id: true },
        },
        questionBanks: {
          select: { id: true, phase: true, recordStatus: true },
        },
      },
      orderBy: [{ departmentId: "asc" }, { subjectCode: "asc" }],
    });
  }

  async createSubject(actor: Actor, payload: SubjectPayload) {
    const department = await prisma.department.findUnique({
      where: { id: payload.departmentId },
      select: { id: true },
    });
    if (!department) {
      throw new NotFoundError("Department not found");
    }
    if (actor.role === Role.COORDINATOR) {
      await this.deptUtils.assertDepartmentAccess(actor, payload.departmentId);
    }

    const currentAcademicYear = await prisma.academicYear.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { startDate: "desc" },
    });
    if (!currentAcademicYear) {
      throw new AppError("No active academic year found. Activate an academic year before creating subjects.", 400);
    }

    return prisma.$transaction(async (tx) => {
      const subject = await withUniqueCheck(
        () =>
          tx.subject.create({
            data: {
              subjectCode: payload.subjectCode,
              subjectName: payload.subjectName,
              credits: payload.creditLoad,
              status: SubjectStatus.ACTIVE,
              questionBankDueDate: addDays(30),
              departmentId: payload.departmentId,
            },
            include: { department: true },
          }),
        "Subject_subjectCode_departmentId_key",
      );

      await tx.subjectVersion.create({
        data: {
          subjectId: subject.id,
          versionNumber: 1,
          title: payload.subjectName,
          syllabusDescription: null,
          effectiveFromAcademicYearId: currentAcademicYear.id,
          status: "ACTIVE",
        },
      });

      return subject;
    });
  }

  async updateSubject(actor: Actor, subjectId: string, payload: SubjectUpdatePayload) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new NotFoundError("Subject not found");
    await this.deptUtils.assertDepartmentAccess(actor, subject.departmentId);

    return prisma.subject.update({
      where: { id: subjectId },
      data: {
        ...(payload.subjectCode !== undefined ? { subjectCode: payload.subjectCode } : {}),
        ...(payload.subjectName !== undefined ? { subjectName: payload.subjectName } : {}),
        ...(payload.creditLoad !== undefined ? { credits: payload.creditLoad } : {}),
      },
      include: { department: true },
    });
  }

  async deactivateSubject(actor: Actor, subjectId: string) {
    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subject) throw new NotFoundError("Subject not found");
    await this.deptUtils.assertDepartmentAccess(actor, subject.departmentId);

    return prisma.subject.update({
      where: { id: subjectId },
      data: { status: SubjectStatus.INACTIVE },
      include: { department: true },
    });
  }

  async linkSubjectToExamCycle(actor: Actor, subjectId: string, examCycleId: string) {
    const [subject, examCycle] = await Promise.all([
      prisma.subject.findUnique({ where: { id: subjectId } }),
      prisma.examCycle.findUnique({
        where: { id: examCycleId },
        include: { batchSemester: { include: { batch: true } } },
      }),
    ]);

    if (!subject) throw new NotFoundError("Subject not found");
    if (!examCycle) throw new NotFoundError("Exam cycle not found");
    await this.deptUtils.assertDepartmentAccess(actor, subject.departmentId);
    if (examCycle.status !== "ACTIVE") {
      throw new AppError("Only active exam cycles can be linked.", 400);
    }

    const placement = await prisma.curriculumSubject.findFirst({
      where: {
        subjectId,
        curriculumSchemeId: examCycle.batchSemester.batch.curriculumSchemeId,
        semesterNumber: examCycle.batchSemester.semesterNumber,
      },
    });
    if (!placement) {
      throw new AppError(
        "Subject must be placed in the curriculum before linking to an exam cycle. Use 'Place in Curriculum' first.",
        400,
      );
    }

    return prisma.subjectExamCycleLink.upsert({
      where: { subjectId_examCycleId: { subjectId, examCycleId } },
      update: {},
      create: { subjectId, examCycleId },
      include: { subject: true, examCycle: true },
    });
  }
}
