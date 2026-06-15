import { BaseRepository } from "@/modules/shared/base-repository";

export class CoordinatorDepartmentAssignmentRepository extends BaseRepository {
  list() {
    return this.prisma.coordinatorDepartmentAssignment.findMany({
      include: {
        coordinator: { select: { id: true, name: true, email: true, role: true } },
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { assignedAt: "desc" },
    });
  }

  findById(id: string) {
    return this.prisma.coordinatorDepartmentAssignment.findUnique({
      where: { id },
      include: {
        coordinator: { select: { id: true, name: true, email: true, role: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
  }

  findByCoordinatorAndDepartment(coordinatorId: string, departmentId: string) {
    return this.prisma.coordinatorDepartmentAssignment.findUnique({
      where: { coordinatorId_departmentId: { coordinatorId, departmentId } },
    });
  }

  create(data: { coordinatorId: string; departmentId: string }) {
    return this.prisma.coordinatorDepartmentAssignment.create({
      data,
      include: {
        coordinator: { select: { id: true, name: true, email: true, role: true } },
        department: { select: { id: true, name: true, code: true } },
      },
    });
  }

  delete(id: string) {
    return this.prisma.coordinatorDepartmentAssignment.delete({ where: { id } });
  }
}
