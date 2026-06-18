"use server";

import { prisma } from "@/lib/db";

export async function getSubjectsForBatchSemester(batchSemesterId: string) {
  const batchSemester = await prisma.batchSemester.findUnique({
    where: { id: batchSemesterId },
    include: {
      batch: { select: { id: true, curriculumSchemeId: true } },
      academicUnit: { select: { id: true, name: true, code: true } },
    },
  });

  if (!batchSemester || !batchSemester.batch.curriculumSchemeId) return [];

  const curriculumSubjects = await prisma.curriculumSubject.findMany({
    where: {
      curriculumSchemeId: batchSemester.batch.curriculumSchemeId,
      semesterNumber: batchSemester.semesterNumber,
      academicUnitId: batchSemester.academicUnitId,
    },
    include: {
      subject: {
        select: { id: true, subjectCode: true, subjectName: true, credits: true },
      },
      academicUnit: {
        select: { id: true, name: true, code: true },
      },
    },
    orderBy: [{ subject: { subjectCode: "asc" } }],
  });

  return curriculumSubjects.map((cs) => ({
    subjectId: cs.subject.id,
    subjectCode: cs.subject.subjectCode,
    subjectName: cs.subject.subjectName,
    credits: cs.subject.credits,
    groupAssignment: cs.groupAssignment,
    academicUnitName: cs.academicUnit?.name ?? cs.academicUnit?.name ?? "",
  }));
}
