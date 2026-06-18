import { SubjectVersionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";

export class SubjectVersionRepository {
  findBySubject(subjectId: string) {
    return prisma.subjectVersion.findMany({
      where: { subjectId },
      orderBy: { versionNumber: "desc" },
      include: { effectiveFromAcademicYear: true, subject: true },
    });
  }

  findById(id: string) {
    return prisma.subjectVersion.findUnique({
      where: { id },
      include: { effectiveFromAcademicYear: true, subject: true },
    });
  }

  findActiveBySubject(subjectId: string) {
    return prisma.subjectVersion.findFirst({
      where: { subjectId, status: SubjectVersionStatus.ACTIVE },
      include: { effectiveFromAcademicYear: true, subject: true },
    });
  }

  create(data: {
    subjectId: string;
    versionNumber: number;
    title: string;
    syllabusDescription?: string | null;
    effectiveFromAcademicYearId: string;
    status?: SubjectVersionStatus;
  }) {
    return prisma.subjectVersion.create({
      data,
      include: { effectiveFromAcademicYear: true, subject: true },
    });
  }

  update(id: string, data: Partial<{
    title: string;
    syllabusDescription: string | null;
    effectiveFromAcademicYearId: string;
    status: SubjectVersionStatus;
  }>) {
    return prisma.subjectVersion.update({
      where: { id },
      data,
      include: { effectiveFromAcademicYear: true, subject: true },
    });
  }
}
