import { prisma } from "@/lib/db";
import type { TeachingGroupInput, TeachingGroupUpdateInput } from "@/modules/teaching-groups/validation";

export class TeachingGroupRepository {
  findByBatch(batchId: string) {
    return prisma.teachingGroup.findMany({
      where: { batchId },
      orderBy: { groupNumber: "asc" },
      include: { batch: { select: { id: true, name: true, code: true } } },
    });
  }

  findById(id: string) {
    return prisma.teachingGroup.findUnique({
      where: { id },
      include: { batch: true },
    });
  }

  findByBatchAndGroup(batchId: string, groupNumber: number) {
    return prisma.teachingGroup.findUnique({
      where: { batchId_groupNumber: { batchId, groupNumber } },
    });
  }

  create(data: TeachingGroupInput) {
    return prisma.teachingGroup.create({
      data,
      include: { batch: { select: { id: true, name: true, code: true } } },
    });
  }

  update(id: string, data: TeachingGroupUpdateInput) {
    return prisma.teachingGroup.update({
      where: { id },
      data,
      include: { batch: { select: { id: true, name: true, code: true } } },
    });
  }

  delete(id: string) {
    return prisma.teachingGroup.delete({ where: { id } });
  }

  deleteByBatch(batchId: string) {
    return prisma.teachingGroup.deleteMany({ where: { batchId } });
  }
}
