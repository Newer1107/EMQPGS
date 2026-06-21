import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { ResponsibilityResolver } from "@/lib/auth/responsibility-resolver";
import { AuthorizationService } from "@/lib/auth/authorization-service";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { GenerationTrace, EvaluationReport } from "@/modules/paper-generation-engine/types";

type PaperJsonData = {
  questionIds: string[];
  evaluationReport: EvaluationReport;
  scoreBreakdown: string;
  generationTrace?: GenerationTrace;
};

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromCookies();
    const resolver = new ResponsibilityResolver();
    const auth = await resolver.resolveAsContext(user.id, user);
    new AuthorizationService(auth).requireAny(["DEAN" as const]);
  } catch {
    return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 });
  }

  const segments = request.nextUrl.pathname.split("/");
  const variantIdx = segments.indexOf("papers") + 1;
  const variant = segments[variantIdx];
  const questionBankId = segments[variantIdx - 2];

  if (!variant || !questionBankId) {
    return NextResponse.json({ success: false, error: { message: "Invalid path" } }, { status: 400 });
  }

  try {
    const paper = await prisma.generatedPaper.findUnique({
      where: { questionBankId_variant: { questionBankId, variant: variant as any } },
      include: {
        items: {
          include: { question: true },
          orderBy: { question: { moduleNumber: "asc" as const } },
        },
      },
    }) as Prisma.GeneratedPaperGetPayload<{
      include: { items: { include: { question: true } } }
    }> | null;

    if (!paper) {
      throw new AppError("Paper not found", 404);
    }

    const rawPaperJson = paper.paperJson as PaperJsonData | null;

    if (!rawPaperJson?.evaluationReport) {
      throw new AppError("No generation data available for this paper", 404);
    }

    return NextResponse.json({
      success: true,
      data: {
        variant: paper.variant,
        qualityScore: paper.qualityScore,
        coverageScore: paper.coverageScore,
        difficultyScore: paper.difficultyScore,
        duplicateRisk: paper.duplicateRisk,
        recommendation: paper.recommendation,
        generatedAt: paper.generatedAt?.toISOString() ?? null,
        createdAt: paper.createdAt.toISOString(),
        evaluationReport: rawPaperJson.evaluationReport,
        scoreBreakdown: rawPaperJson.scoreBreakdown,
        generationTrace: rawPaperJson.generationTrace ?? null,
        questions: paper.items.map((item) => ({
          id: item.question.id,
          questionText: item.question.questionText,
          marks: item.question.marks,
          moduleNumber: item.question.moduleNumber,
          co: item.question.coMapping,
          rbtLevel: item.question.rbtLevel,
          difficultyLevel: item.question.difficultyLevel,
          teachingIndex: item.question.teachingIndex,
        })),
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ success: false, error: { message: err.message } }, { status: err.statusCode });
    }
    const msg = err instanceof Error ? err.message : "Failed to load insights";
    return NextResponse.json({ success: false, error: { message: msg } }, { status: 500 });
  }
}
