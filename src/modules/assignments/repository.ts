import { AssignmentRole } from "@prisma/client";
import { BaseRepository } from "@/modules/shared/base-repository";

export class AssignmentRepository extends BaseRepository {
  list() {
    return this.prisma.teacherAssignment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        teacher: true,
        questionBank: { include: { subject: true, examCycle: true } },
      },
    });
  }

  replaceAssignments(questionBankId: string, assignedById: string, moderatorId?: string, contributorIds: string[] = []) {
    return this.prisma.$transaction(async (tx) => {
      await tx.teacherAssignment.deleteMany({
        where: {
          questionBankId,
          assignmentRole: AssignmentRole.CONTRIBUTOR,
        },
      });

      const rows = [
        ...(moderatorId
          ? [
              {
                questionBankId,
                teacherId: moderatorId,
                assignmentRole: AssignmentRole.MODERATOR,
                assignedById,
              },
            ]
          : []),
        ...contributorIds.map((teacherId) => ({
          questionBankId,
          teacherId,
          assignmentRole: AssignmentRole.CONTRIBUTOR,
          assignedById,
        })),
      ];

      if (rows.length) {
        await tx.teacherAssignment.createMany({ data: rows });
      }

      return tx.teacherAssignment.findMany({
        where: { questionBankId },
        include: { teacher: true },
      });
    });
  }
}
