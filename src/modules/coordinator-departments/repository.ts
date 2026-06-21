import { prisma } from "@/lib/db";

export class CoordinatorDepartmentAssignmentRepository {
  list() {
    return prisma.responsibilityAssignment.findMany({
      where: { responsibility: "COORDINATOR", scopeType: "DEPARTMENT" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { assignedAt: "desc" },
    });
  }

  findById(id: string) {
    return prisma.responsibilityAssignment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  findByCoordinatorAndDepartment(coordinatorId: string, departmentId: string) {
    return prisma.responsibilityAssignment.findFirst({
      where: {
        userId: coordinatorId,
        responsibility: "COORDINATOR",
        scopeType: "DEPARTMENT",
        scopeId: departmentId,
      },
    });
  }

  create(data: { coordinatorId: string; departmentId: string }) {
    return prisma.responsibilityAssignment.create({
      data: {
        userId: data.coordinatorId,
        responsibility: "COORDINATOR",
        scopeType: "DEPARTMENT",
        scopeId: data.departmentId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  delete(id: string) {
    return prisma.responsibilityAssignment.delete({ where: { id } });
  }
}
