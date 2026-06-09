import { QuestionBankStatus } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";
import { QuestionBankRepository } from "@/modules/question-banks/repository";
import { QuestionBankInput } from "@/modules/question-banks/validation";

export class QuestionBankService {
  constructor(private readonly repository = new QuestionBankRepository()) {}

  list() {
    return this.repository.list();
  }

  create(data: QuestionBankInput & { createdById: string }) {
    return this.repository.create(data);
  }

  async updateStatus(id: string, status: QuestionBankStatus) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Question bank not found");
    return this.repository.update(id, {
      status,
      lockedAt: status === QuestionBankStatus.LOCKED ? new Date() : null,
    });
  }
}
