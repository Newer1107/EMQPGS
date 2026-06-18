import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { type Actor } from "@/lib/types";
export { type Actor };

export class DepartmentAccessUtils {
  async getAssignedDepartmentIds(actor: Actor) {
    if (actor.role === Role.COE) {
      const all = await prisma.department.findMany({ select: { id: true } });
      return all.map((d) => d.id);
    }
    if (actor.role !== Role.COORDINATOR) throw new ForbiddenError("Only coordinators and COE can access this resource.");
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
