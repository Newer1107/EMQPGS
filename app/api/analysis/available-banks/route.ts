import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";

export const GET = withApiHandler(async (_request, context) => {
  const departmentIds = await new DepartmentAccessUtils().getAssignedDepartmentIds(context.auth!);
  const banks = await prisma.questionBank.findMany({
    where: { recordStatus: "LOCKED", subject: { departmentId: { in: departmentIds } } },
    include: {
      subject: { select: { subjectName: true, subjectCode: true } },
      batchSemester: {
        select: {
          semesterNumber: true,
          batch: { select: { name: true } },
          academicYear: { select: { code: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Attach latest analysis status per bank
  const results = await Promise.all(
    banks.map(async (bank) => {
      const analysis = await prisma.questionBankAnalysis.findFirst({
        where: { questionBankId: bank.id },
        orderBy: { version: "desc" },
        select: {
          id: true,
          status: true,
          qpqi: true,
          qpqiClassification: true,
          version: true,
          completedAt: true,
        },
      });
      return {
        id: bank.id,
        subjectName: bank.subject.subjectName,
        subjectCode: bank.subject.subjectCode,
        semester: bank.batchSemester.semesterNumber,
        batch: bank.batchSemester.batch?.name ?? "",
        academicYear: bank.batchSemester.academicYear?.code ?? "",
        createdAt: bank.createdAt.toISOString(),
        latestAnalysis: analysis ?? null,
      };
    }),
  );

  return results;
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });
