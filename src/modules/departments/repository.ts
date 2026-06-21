import { prisma } from "@/lib/db";
import { DepartmentInput } from "@/modules/departments/validation";

export class DepartmentRepository {
  list() {
    return prisma.department.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { subjects: true } } },
    });
  }

  findById(id: string) {
    return prisma.department.findUnique({ where: { id } });
  }

  create(data: DepartmentInput) {
    return prisma.department.create({ data });
  }

  update(id: string, data: Partial<DepartmentInput>) {
    return prisma.department.update({ where: { id }, data });
  }

  delete(id: string) {
    return prisma.department.delete({ where: { id } });
  }
}
