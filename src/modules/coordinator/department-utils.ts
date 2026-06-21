import { prisma } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { AuthorizationService } from "@/lib/auth/authorization-service";
import type { AuthContext } from "@/lib/types";
export type { AuthContext };

export class DepartmentAccessUtils {
  async getAssignedDepartmentIds(authContext: AuthContext) {
    const authz = new AuthorizationService(authContext);

    if (authz.has("COE" as const, "INSTITUTION" as const)) {
      const all = await prisma.department.findMany({ select: { id: true } });
      return all.map((d) => d.id);
    }

    if (authz.has("DEAN" as const)) {
      const deanDepts = authz.getScopeIds("DEAN" as const, "DEPARTMENT" as const);
      if (deanDepts.length > 0) return deanDepts;
      if (authz.has("DEAN" as const, "INSTITUTION" as const)) {
        const all = await prisma.department.findMany({ select: { id: true } });
        return all.map((d) => d.id);
      }
    }

    const departmentIds = authz.getScopeIds("COORDINATOR" as const, "DEPARTMENT" as const);
    if (departmentIds.length === 0) {
      throw new ForbiddenError("Only coordinators and COE can access this resource.");
    }
    return departmentIds;
  }

  async assertDepartmentAccess(authContext: AuthContext, departmentId: string) {
    const assignedDepartmentIds = await this.getAssignedDepartmentIds(authContext);
    if (!assignedDepartmentIds.includes(departmentId)) {
      throw new ForbiddenError("You do not have access to that department.");
    }
  }
}
