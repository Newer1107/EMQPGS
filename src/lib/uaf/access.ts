import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import type { AuthContext } from "@/lib/types";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { pipelineFilter, type AnalysisPipeline } from "./pipeline";

export async function requireAnalysisAccess(auth: AuthContext, bankId: string, versionIds: string[] = [], pipeline?: AnalysisPipeline) {
  const bank = await prisma.questionBank.findUnique({ where: { id: bankId }, select: { subject: { select: { departmentId: true } } } });
  if (!bank) throw new NotFoundError("Question bank not found");
  await new DepartmentAccessUtils().assertDepartmentAccess(auth, bank.subject.departmentId);
  for (const id of new Set(versionIds)) {
    const origin = pipeline ? pipelineFilter(pipeline) : {};
    const version = await prisma.analysisVersion.findFirst({ where: { id, ...origin, questionBankAnalysis: { questionBankId: bankId, ...origin } }, select: { id: true } });
    if (!version) throw new NotFoundError("Analysis version not found in this bank");
  }
}
