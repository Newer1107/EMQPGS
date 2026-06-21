import { CoordinatorDepartmentAssignmentRepository } from "@/modules/coordinator-departments/repository";
import type { CoordinatorDepartmentAssignmentInput } from "@/modules/coordinator-departments/validation";
import { AppError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/db";

export class CoordinatorDepartmentAssignmentService {
  constructor(private readonly repository = new CoordinatorDepartmentAssignmentRepository()) {}

  list() {
    return this.repository.list();
  }

  async create(data: CoordinatorDepartmentAssignmentInput & { assignedById: string }) {
    const coordinator = await prisma.user.findUnique({
      where: { id: data.coordinatorId },
      select: { id: true, name: true },
    });
    if (!coordinator) throw new NotFoundError("Coordinator not found");

    const department = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!department) throw new NotFoundError("Department not found");

    const existing = await this.repository.findByCoordinatorAndDepartment(data.coordinatorId, data.departmentId);
    if (existing) throw new AppError("This user is already assigned as Coordinator for this Department.", 409);

    return this.repository.create({ coordinatorId: data.coordinatorId, departmentId: data.departmentId, assignedById: data.assignedById });
  }

  async delete(id: string, deletedById: string) {
    const assignment = await this.repository.findById(id);
    if (!assignment) throw new NotFoundError("Assignment not found");
    return this.repository.delete(id, deletedById);
  }
}
