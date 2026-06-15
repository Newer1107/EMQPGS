import { SubjectVersionStatus } from "@prisma/client";
import { NotFoundError, AppError } from "@/lib/errors";
import { withUniqueCheck } from "@/lib/db-helpers";
import { SubjectVersionRepository } from "@/modules/subject-versions/repository";
import { prisma } from "@/lib/db";
import type { SubjectVersionInput } from "@/modules/subject-versions/validation";

export class SubjectVersionService {
  constructor(private readonly repository = new SubjectVersionRepository()) {}

  async findBySubject(subjectId: string) {
    return this.repository.findBySubject(subjectId);
  }

  async findById(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Subject version not found");
    return entity;
  }

  async findActiveBySubject(subjectId: string) {
    return this.repository.findActiveBySubject(subjectId);
  }

  async create(input: SubjectVersionInput) {
    const existingActive = await this.repository.findActiveBySubject(input.subjectId);
    if (existingActive) {
      await this.repository.update(existingActive.id, { status: SubjectVersionStatus.ARCHIVED });
    }

    const lastVersion = await prisma.subjectVersion.findFirst({
      where: { subjectId: input.subjectId },
      orderBy: { versionNumber: "desc" },
    });
    const nextVersionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    return withUniqueCheck(
      () => this.repository.create({
        subjectId: input.subjectId,
        versionNumber: nextVersionNumber,
        title: input.title,
        syllabusDescription: input.syllabusDescription ?? null,
        effectiveFromAcademicYearId: input.effectiveFromAcademicYearId,
        status: input.status ?? SubjectVersionStatus.ACTIVE,
      }),
      "SubjectVersion_subjectId_versionNumber_key",
    );
  }

  async archive(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Subject version not found");
    return this.repository.update(id, { status: SubjectVersionStatus.ARCHIVED });
  }
}
