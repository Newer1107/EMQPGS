import { BaseRepository } from "@/modules/shared/base-repository";
import type { TeachingGroupInput, TeachingGroupUpdateInput } from "@/modules/teaching-groups/validation";

export class TeachingGroupRepository extends BaseRepository {
  findByBatch(batchId: string) {
    return this.prisma.teachingGroup.findMany({
      where: { batchId },
      orderBy: { groupNumber: "asc" },
      include: { batch: { select: { id: true, name: true, code: true } } },
    });
  }

  findById(id: string) {
    return this.prisma.teachingGroup.findUnique({
      where: { id },
      include: { batch: true },
    });
  }

  findByBatchAndGroup(batchId: string, groupNumber: number) {
    return this.prisma.teachingGroup.findUnique({
      where: { batchId_groupNumber: { batchId, groupNumber } },
    });
  }

  create(data: TeachingGroupInput) {
    return this.prisma.teachingGroup.create({
      data,
      include: { batch: { select: { id: true, name: true, code: true } } },
    });
  }

  update(id: string, data: TeachingGroupUpdateInput) {
    return this.prisma.teachingGroup.update({
      where: { id },
      data,
      include: { batch: { select: { id: true, name: true, code: true } } },
    });
  }

  delete(id: string) {
    return this.prisma.teachingGroup.delete({ where: { id } });
  }

  deleteByBatch(batchId: string) {
    return this.prisma.teachingGroup.deleteMany({ where: { batchId } });
  }
}
