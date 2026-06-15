import { Role } from "@prisma/client";
import { CoordinatorDepartmentAssignmentRepository } from "@/modules/coordinator-departments/repository";
import { CoordinatorDepartmentAssignmentInput } from "@/modules/coordinator-departments/validation";
import { AppError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/db";

export class CoordinatorDepartmentAssignmentService {
  constructor(private readonly repository = new CoordinatorDepartmentAssignmentRepository()) {}

  list() {
    return this.repository.list();
  }

  async create(data: CoordinatorDepartmentAssignmentInput) {
    const coordinator = await prisma.user.findUnique({
      where: { id: data.coordinatorId },
      select: { id: true, role: true },
    });
    if (!coordinator) throw new NotFoundError("Coordinator not found");
    if (coordinator.role !== Role.COORDINATOR) {
      throw new AppError("Only users with the COORDINATOR role can be assigned to departments.", 400);
    }

    const department = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!department) throw new NotFoundError("Department not found");

    const existing = await this.repository.findByCoordinatorAndDepartment(data.coordinatorId, data.departmentId);
    if (existing) throw new AppError("Coordinator is already assigned to this department.", 409);

    return this.repository.create(data);
  }

  async delete(id: string) {
    const assignment = await this.repository.findById(id);
    if (!assignment) throw new NotFoundError("Assignment not found");
    return this.repository.delete(id);
  }
}
