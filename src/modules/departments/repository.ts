import { BaseRepository } from "@/modules/shared/base-repository";
import { DepartmentInput } from "@/modules/departments/validation";

export class DepartmentRepository extends BaseRepository {
  list() {
    return this.prisma.department.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { users: true, subjects: true } } },
    });
  }

  findById(id: string) {
    return this.prisma.department.findUnique({ where: { id } });
  }

  create(data: DepartmentInput) {
    return this.prisma.department.create({ data });
  }

  update(id: string, data: Partial<DepartmentInput>) {
    return this.prisma.department.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.department.delete({ where: { id } });
  }
}
