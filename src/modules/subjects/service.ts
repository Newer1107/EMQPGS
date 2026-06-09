import { NotFoundError } from "@/lib/errors";
import { SubjectRepository } from "@/modules/subjects/repository";
import { SubjectInput } from "@/modules/subjects/validation";

export class SubjectService {
  constructor(private readonly repository = new SubjectRepository()) {}

  list() {
    return this.repository.list();
  }

  create(data: SubjectInput) {
    return this.repository.create(data);
  }

  async update(id: string, data: Partial<SubjectInput>) {
    const entity = await this.repository.findById(id);
    if (!entity) throw new NotFoundError("Subject not found");
    return this.repository.update(id, data);
  }
}
