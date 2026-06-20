import { NotFoundError, AppError } from "@/lib/errors";
import { withUniqueCheck } from "@/lib/db-helpers";
import { CurriculumSchemeRepository } from "@/modules/curriculum-schemes/repository";
import type { CurriculumSchemeInput, CurriculumSchemeUpdateInput } from "@/modules/curriculum-schemes/validation";

export class CurriculumSchemeService {
  constructor(private readonly repository = new CurriculumSchemeRepository()) {}

  list() {
    return this.repository.list();
  }

  async findByDepartment(departmentId: string) {
    return this.repository.findByDepartment(departmentId);
  }

  async findById(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Curriculum scheme not found");
    return entity;
  }

  async create(data: CurriculumSchemeInput) {
    const existing = await this.repository.findActiveByDepartment(data.departmentId);
    if (existing && data.isActive !== false) {
      await this.repository.deactivateAllForDepartment(data.departmentId);
    }
    return withUniqueCheck(() => this.repository.create(data));
  }

  async update(id: string, data: CurriculumSchemeUpdateInput) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Curriculum scheme not found");

    if (data.isActive === true) {
      await this.repository.deactivateAllForDepartment(entity.departmentId, id);
    }

    return this.repository.update(id, data);
  }

  async activate(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Curriculum scheme not found");
    await this.repository.deactivateAllForDepartment(entity.departmentId, id);
    return this.repository.update(id, { isActive: true });
  }

  async delete(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Curriculum scheme not found");
    const hasRefs = await this.repository.hasReferencedData(id);
    if (hasRefs) {
      throw new AppError("Cannot delete scheme with existing curriculum subjects or batches", 409);
    }
    return this.repository.delete(id);
  }
}
