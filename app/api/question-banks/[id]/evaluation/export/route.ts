import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { requireAnalysisAccess } from "@/lib/uaf/access";
import { EVALUATION_ANALYSIS_FILTER } from "@/lib/uaf/pipeline";
import { exportEvaluationPdf } from "@/modules/evaluation-export/pdf";
import type { EvaluationReport } from "@/lib/evaluation/types";

export const runtime = "nodejs";
export const GET = withApiHandler(async (request, context) => {
  const bankId = request.nextUrl.pathname.split("/")[3]!;
  const versionId = request.nextUrl.searchParams.get("versionId");
  await requireAnalysisAccess(context.auth!, bankId, versionId ? [versionId] : [], "evaluation");
  const version = await prisma.analysisVersion.findFirst({
    where: { ...(versionId ? { id: versionId } : {}), ...EVALUATION_ANALYSIS_FILTER, questionBankAnalysis: { questionBankId: bankId, ...EVALUATION_ANALYSIS_FILTER } },
    orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }],
    include: { analysisSnapshot: true },
  });
  if (!version) throw new NotFoundError("Evaluation version not found for this question bank");
  const report = version.analysisSnapshot?.fullReport as EvaluationReport | null | undefined;
  if (!report) throw new NotFoundError("Evaluation report not available for this version");
  const pdf = await exportEvaluationPdf(report, version.versionNumber);
  return new NextResponse(Buffer.from(pdf), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="evaluation-report-v${version.versionNumber}.pdf"`,
    "X-Content-Type-Options": "nosniff",
  } });
}, { responsibility: ["DEAN", "COORDINATOR"], responseType: "raw" });
