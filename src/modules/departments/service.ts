import { DepartmentRepository } from "@/modules/departments/repository";
import { DepartmentInput } from "@/modules/departments/validation";
import { AppError, NotFoundError } from "@/lib/errors";

export class DepartmentService {
  constructor(private readonly repository = new DepartmentRepository()) {}

  list() {
    return this.repository.list();
  }

  async create(data: DepartmentInput) {
    const existing = (await this.repository.list()).find((department) => department.code === data.code);
    if (existing) throw new AppError("Department code already exists", 409);
    return this.repository.create(data);
  }

  async update(id: string, data: Partial<DepartmentInput>) {
    const department = await this.repository.findById(id);
    if (!department) throw new NotFoundError("Department not found");
    if (data.code && data.code !== department.code) {
      const existing = (await this.repository.list()).find((item) => item.code === data.code && item.id !== id);
      if (existing) throw new AppError("Department code already exists", 409);
    }
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    const department = await this.repository.findById(id);
    if (!department) throw new NotFoundError("Department not found");
    return this.repository.delete(id);
  }
}
