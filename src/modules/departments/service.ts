import { DepartmentRepository } from "@/modules/departments/repository";
import { DepartmentInput } from "@/modules/departments/validation";
import { NotFoundError } from "@/lib/errors";

export class DepartmentService {
  constructor(private readonly repository = new DepartmentRepository()) {}

  list() {
    return this.repository.list();
  }

  create(data: DepartmentInput) {
    return this.repository.create(data);
  }

  async update(id: string, data: Partial<DepartmentInput>) {
    const department = await this.repository.findById(id);
    if (!department) throw new NotFoundError("Department not found");
    return this.repository.update(id, data);
  }

  async delete(id: string) {
    const department = await this.repository.findById(id);
    if (!department) throw new NotFoundError("Department not found");
    return this.repository.delete(id);
  }
}
