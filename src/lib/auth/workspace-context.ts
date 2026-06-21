import { prisma } from "@/lib/db";
import type { ActiveWorkspace } from "@/lib/auth/workspace-resolver";
import type { Subject, SubjectVersion, BatchSemester, Batch, AcademicYear, Department, Prisma } from "@prisma/client";

const questionBankInclude = {
  subject: true,
  pattern: true,
  slots: {
    include: {
      assignedQuestion: { select: { id: true, status: true, ownerId: true, moduleNumber: true, marks: true } },
    },
    orderBy: [{ moduleNumber: "asc" as const }, { marks: "asc" as const }, { slotNumber: "asc" as const }],
  },
  batchSemester: { include: { batch: true, academicYear: true } },
} satisfies Prisma.QuestionBankInclude;

type QuestionBankWithIncludes = Prisma.QuestionBankGetPayload<{ include: typeof questionBankInclude }>;

export type WorkspaceContext = {
  bankId: string;
  questionBank: QuestionBankWithIncludes;
  subject: Subject;
  subjectVersion: SubjectVersion | null;
  batchSemester: BatchSemester & { batch: Batch; academicYear: AcademicYear };
  department: Department | null;
  userId: string;
  userName: string;
  userEmail: string;
};

export class WorkspaceContextResolver {
  async resolve(aws: ActiveWorkspace, identity?: { id: string; name: string; email: string }): Promise<WorkspaceContext> {
    const bankId = aws.scopeId;
    if (!bankId) {
      throw new Error(`Workspace ${aws.responsibility} has no scopeId — cannot resolve context`);
    }

    const questionBank = await prisma.questionBank.findUnique({
      where: { id: bankId },
      include: questionBankInclude,
    });

    if (!questionBank) {
      throw new Error(`QuestionBank ${bankId} not found for active workspace`);
    }

    const subjectVersion = await prisma.subjectVersion.findFirst({
      where: { subjectId: questionBank.subjectId, status: "ACTIVE" },
    });

    const department = await prisma.department.findUnique({
      where: { id: questionBank.subject.departmentId },
    });

    return {
      bankId,
      questionBank,
      subject: questionBank.subject,
      subjectVersion,
      batchSemester: questionBank.batchSemester as WorkspaceContext["batchSemester"],
      department,
      userId: identity?.id ?? "",
      userName: identity?.name ?? "",
      userEmail: identity?.email ?? "",
    };
  }
}
