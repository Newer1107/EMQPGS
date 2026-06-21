import { prisma } from "@/lib/db";

const ACTIVE_FILTER = { deletedAt: null } as const;

export class CoordinatorDepartmentAssignmentRepository {
  list() {
    return prisma.responsibilityAssignment.findMany({
      where: { responsibility: "COORDINATOR", scopeType: "DEPARTMENT", ...ACTIVE_FILTER },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { assignedAt: "desc" },
    });
  }

  findById(id: string) {
    return prisma.responsibilityAssignment.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  findByCoordinatorAndDepartment(coordinatorId: string, departmentId: string) {
    return prisma.responsibilityAssignment.findFirst({
      where: {
        userId: coordinatorId,
        responsibility: "COORDINATOR",
        scopeType: "DEPARTMENT",
        scopeId: departmentId,
        ...ACTIVE_FILTER,
      },
    });
  }

  create(data: { coordinatorId: string; departmentId: string; assignedById: string }) {
    return prisma.responsibilityAssignment.create({
      data: {
        userId: data.coordinatorId,
        responsibility: "COORDINATOR",
        scopeType: "DEPARTMENT",
        scopeId: data.departmentId,
        assignedById: data.assignedById,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  delete(id: string, deletedById: string) {
    return prisma.responsibilityAssignment.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById },
    });
  }
}
