import { NotFoundError, AppError } from "@/lib/errors";
import { withUniqueCheck } from "@/lib/db-helpers";
import { TeachingGroupRepository } from "@/modules/teaching-groups/repository";
import type { TeachingGroupInput, TeachingGroupUpdateInput, TeachingGroupBulkInput } from "@/modules/teaching-groups/validation";
import { prisma } from "@/lib/db";

export class TeachingGroupService {
  constructor(private readonly repository = new TeachingGroupRepository()) {}

  async findByBatch(batchId: string) {
    return this.repository.findByBatch(batchId);
  }

  async findById(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Teaching group not found");
    return entity;
  }

  async create(data: TeachingGroupInput) {
    const existing = await this.repository.findByBatchAndGroup(data.batchId, data.groupNumber);
    if (existing) throw new AppError("This teaching group already exists for this batch", 409);

    const batch = await prisma.batch.findUnique({ where: { id: data.batchId } });
    if (!batch) throw new NotFoundError("Batch not found");

    return withUniqueCheck(() => this.repository.create(data));
  }

  async update(id: string, data: TeachingGroupUpdateInput) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Teaching group not found");
    return this.repository.update(id, data);
  }

  async bulkCreate(data: TeachingGroupBulkInput) {
    const batch = await prisma.batch.findUnique({ where: { id: data.batchId } });
    if (!batch) throw new NotFoundError("Batch not found");

    const results = [];
    for (const group of data.groups) {
      const existing = await this.repository.findByBatchAndGroup(data.batchId, group.groupNumber);
      if (!existing) {
        results.push(await withUniqueCheck(() =>
          this.repository.create({
            batchId: data.batchId,
            groupNumber: group.groupNumber,
            name: group.name,
            description: group.description,
          }),
        ));
      } else {
        results.push(existing);
      }
    }
    return results;
  }

  async delete(id: string) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Teaching group not found");
    return this.repository.delete(id);
  }
}
