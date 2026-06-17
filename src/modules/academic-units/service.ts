import { prisma } from "@/lib/db";
import { NotFoundError, AppError } from "@/lib/errors";
import { withUniqueCheck } from "@/lib/db-helpers";
import { AcademicUnitRepository } from "@/modules/academic-units/repository";
import type { AcademicUnitInput, AcademicUnitUpdateInput } from "@/modules/academic-units/validation";

export class AcademicUnitService {
  constructor(private readonly repository = new AcademicUnitRepository()) {}

  list() {
    return this.repository.list();
  }

  async findById(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Academic unit not found");
    return entity;
  }

  async create(data: AcademicUnitInput) {
    const existing = await this.repository.findByCode(data.code);
    if (existing) throw new AppError("An academic unit with this code already exists", 409);
    return withUniqueCheck(() => this.repository.create(data));
  }

  async update(id: string, data: AcademicUnitUpdateInput) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Academic unit not found");
    if (data.code && data.code !== entity.code) {
      const existing = await this.repository.findByCode(data.code);
      if (existing) throw new AppError("An academic unit with this code already exists", 409);
    }
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Academic unit not found");
    const hasRefs = await this.repository.hasReferencedData(id);
    if (hasRefs) {
      throw new AppError("Cannot delete academic unit with existing programmes or curriculum subjects", 409);
    }
    return this.repository.update(id, { isActive: false });
  }
}
