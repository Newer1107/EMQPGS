import { AppError, NotFoundError } from "@/lib/errors";
import { ExamCycleRepository } from "@/modules/exam-cycles/repository";
import { ExamCycleInput } from "@/modules/exam-cycles/validation";
import { prisma } from "@/lib/db";

export class ExamCycleService {
  constructor(private readonly repository = new ExamCycleRepository()) {}

  list() {
    return this.repository.list();
  }

  async create(data: ExamCycleInput) {
    await this.assertSingleActiveCycle(data);
    return this.repository.create(data);
  }

  async update(id: string, data: Partial<ExamCycleInput>) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Exam cycle not found");
    await this.assertSingleActiveCycle(
      {
        status: data.status ?? entity.status,
        departmentId: data.departmentId ?? entity.departmentId,
      },
      id,
    );
    return this.repository.update(id, data);
  }

  private async assertSingleActiveCycle(data: Partial<ExamCycleInput>, excludeId?: string) {
    if (data.status !== "ACTIVE") return;

    const existing = await prisma.examCycle.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        status: "ACTIVE",
        departmentId: data.departmentId ?? null,
      },
    });

    if (existing) {
      throw new AppError("Another active exam cycle already exists for this department", 409);
    }
  }
}
