import { NotFoundError } from "@/lib/errors";
import { withUniqueCheck } from "@/lib/db-helpers";
import { SemesterRepository } from "@/modules/semesters/repository";
import type { SemesterInput } from "@/modules/semesters/validation";

export class SemesterService {
  constructor(private readonly repository = new SemesterRepository()) {}

  list() {
    return this.repository.list();
  }

  async create(data: SemesterInput) {
    return withUniqueCheck(
      () => this.repository.create(data),
      "Semester_academicYearId_number_key",
    );
  }

  async update(id: string, data: { number?: number; name?: string }) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Semester not found");
    return this.repository.update(id, data);
  }

  async findById(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Semester not found");
    return entity;
  }

  findByAcademicYear(academicYearId: string) {
    return this.repository.findByAcademicYear(academicYearId);
  }
}
