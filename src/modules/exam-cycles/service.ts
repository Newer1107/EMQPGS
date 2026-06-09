import { NotFoundError } from "@/lib/errors";
import { ExamCycleRepository } from "@/modules/exam-cycles/repository";
import { ExamCycleInput } from "@/modules/exam-cycles/validation";

export class ExamCycleService {
  constructor(private readonly repository = new ExamCycleRepository()) {}

  list() {
    return this.repository.list();
  }

  create(data: ExamCycleInput) {
    return this.repository.create(data);
  }

  async update(id: string, data: Partial<ExamCycleInput>) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Exam cycle not found");
    return this.repository.update(id, data);
  }
}
