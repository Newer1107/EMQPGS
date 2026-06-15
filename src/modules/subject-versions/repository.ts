import { SubjectVersionStatus } from "@prisma/client";
import { BaseRepository } from "@/modules/shared/base-repository";

export class SubjectVersionRepository extends BaseRepository {
  findBySubject(subjectId: string) {
    return this.prisma.subjectVersion.findMany({
      where: { subjectId },
      orderBy: { versionNumber: "desc" },
      include: { effectiveFromAcademicYear: true, subject: true },
    });
  }

  findById(id: string) {
    return this.prisma.subjectVersion.findUnique({
      where: { id },
      include: { effectiveFromAcademicYear: true, subject: true },
    });
  }

  findActiveBySubject(subjectId: string) {
    return this.prisma.subjectVersion.findFirst({
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
    return this.prisma.subjectVersion.create({
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
    return this.prisma.subjectVersion.update({
      where: { id },
      data,
      include: { effectiveFromAcademicYear: true, subject: true },
    });
  }
}
