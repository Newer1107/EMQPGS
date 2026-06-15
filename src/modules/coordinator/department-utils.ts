import { Role, type User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";

export type Actor = Pick<User, "id" | "role" | "email" | "name">;

export class DepartmentAccessUtils {
  async getAssignedDepartmentIds(actor: Actor) {
    if (actor.role !== Role.COORDINATOR) throw new ForbiddenError("Only coordinators can access this resource.");
    const assignments = await prisma.coordinatorDepartmentAssignment.findMany({
      where: { coordinatorId: actor.id },
      select: { departmentId: true },
    });
    const departmentIds = assignments.map((assignment) => assignment.departmentId);
    if (departmentIds.length === 0) {
      throw new ForbiddenError("Coordinator is not assigned to any departments.");
    }
    return departmentIds;
  }

  async assertDepartmentAccess(actor: Actor, departmentId: string) {
    const assignedDepartmentIds = await this.getAssignedDepartmentIds(actor);
    if (!assignedDepartmentIds.includes(departmentId)) {
      throw new ForbiddenError("You do not have access to that department.");
    }
  }
}
