import { prisma } from "@/lib/db";
import { NotFoundError, AppError } from "@/lib/errors";
import { withUniqueCheck } from "@/lib/db-helpers";
import { ProgrammeRepository } from "@/modules/programmes/repository";
import type { ProgrammeInput, ProgrammeUpdateInput } from "@/modules/programmes/validation";

export class ProgrammeService {
  constructor(private readonly repository = new ProgrammeRepository()) {}

  list() {
    return this.repository.list();
  }

  async findById(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Programme not found");
    return entity;
  }

  async create(data: ProgrammeInput) {
    const existing = await this.repository.findByCode(data.code);
    if (existing) throw new AppError("A programme with this code already exists", 409);

    const homeUnit = await prisma.academicUnit.findUnique({ where: { id: data.homeAcademicUnitId } });
    if (!homeUnit) throw new NotFoundError("Home academic unit not found");
    if (!homeUnit.isActive) {
      throw new AppError("Cannot create a programme under an inactive academic unit", 400);
    }

    if (data.firstYearAcademicUnitId) {
      const fyUnit = await prisma.academicUnit.findUnique({ where: { id: data.firstYearAcademicUnitId } });
      if (!fyUnit) throw new NotFoundError("First year academic unit not found");
      if (!fyUnit.isActive) {
        throw new AppError("Cannot use an inactive first year academic unit", 400);
      }
    }

    return withUniqueCheck(() => this.repository.create(data));
  }

  async update(id: string, data: ProgrammeUpdateInput) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Programme not found");
    if (data.code && data.code !== entity.code) {
      const existing = await this.repository.findByCode(data.code);
      if (existing) throw new AppError("A programme with this code already exists", 409);
    }
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Programme not found");
    const hasRefs = await this.repository.hasReferencedData(id);
    if (hasRefs) {
      throw new AppError("Cannot delete programme with existing curriculum schemes or batches", 409);
    }
    return prisma.programme.delete({ where: { id } });
  }
}
