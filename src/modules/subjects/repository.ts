import { BaseRepository } from "@/modules/shared/base-repository";
import { SubjectInput } from "@/modules/subjects/validation";

export class SubjectRepository extends BaseRepository {
  list() {
    return this.prisma.subject.findMany({
      orderBy: { createdAt: "desc" },
      include: { department: true, questionBanks: true },
    });
  }

  findById(id: string) {
    return this.prisma.subject.findUnique({ where: { id } });
  }

  create(data: SubjectInput) {
    return this.prisma.subject.create({ data });
  }

  update(id: string, data: Partial<SubjectInput>) {
    return this.prisma.subject.update({ where: { id }, data });
  }
}
