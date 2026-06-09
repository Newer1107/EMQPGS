import { QuestionBankStatus, Role } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { QuestionService } from "@/modules/questions/service";

const mockRepository = {
  findById: vi.fn(),
};

describe("Question bank locking", () => {
  it("blocks editing when the bank is locked", async () => {
    const service = new QuestionService(mockRepository as never, {} as never, {} as never);
    mockRepository.findById.mockResolvedValue({
      id: "q-1",
      contributorId: "user-1",
      status: "DRAFT",
      questionBank: { status: QuestionBankStatus.LOCKED },
    });

    await expect(
      service.updateQuestion(
        "q-1",
        { questionText: "Updated question text that exceeds the minimum validation length." },
        { id: "user-1", role: Role.CONTRIBUTOR, email: "contributor@example.com", name: "Contributor" },
      ),
    ).rejects.toBeInstanceOf(AppError);
  });
});
