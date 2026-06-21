import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";

export const GET = withApiHandler(
  async (_request) => {
    const papers = await prisma.generatedPaper.findMany({
      where: { status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      include: {
        questionBank: {
          include: {
            subject: true,
            batchSemester: { include: { academicYear: true } },
            deanReview: { include: { reviewedBy: { select: { id: true, name: true, email: true } } } },
          },
        },
        items: { include: { question: true } },
      },
    });

    return papers.map((paper) => ({
      id: paper.id,
      questionBankId: paper.questionBankId,
      variant: paper.variant,
      status: paper.status,
      subjectCode: paper.questionBank.subject.subjectCode,
      subjectName: paper.questionBank.subject.subjectName,
      semester: paper.questionBank.batchSemester.semesterNumber,
      academicYear: paper.questionBank.batchSemester.academicYear.code,
      overallScore: paper.qualityScore,
      coverageScore: paper.coverageScore,
      difficultyScore: paper.difficultyScore,
      generatedAt: paper.generatedAt?.toISOString() ?? null,
      deanReview: paper.questionBank.deanReview
        ? {
            regularPaper: paper.questionBank.deanReview.regularPaper,
            supplementaryPaper: paper.questionBank.deanReview.supplementaryPaper,
            ktPaper: paper.questionBank.deanReview.ktPaper,
            reviewedAt: paper.questionBank.deanReview.reviewedAt.toISOString(),
            reviewedBy: paper.questionBank.deanReview.reviewedBy,
          }
        : null,
      questionCount: paper.items.length,
    }));
  },
  { responsibility: ["COE" as ResponsibilityType] },
);
