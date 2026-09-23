import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import type { AuthContext } from "@/lib/types";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";

export async function requireAnalysisAccess(auth: AuthContext, bankId: string, versionIds: string[] = []) {
  const bank = await prisma.questionBank.findUnique({ where: { id: bankId }, select: { subject: { select: { departmentId: true } } } });
  if (!bank) throw new NotFoundError("Question bank not found");
  await new DepartmentAccessUtils().assertDepartmentAccess(auth, bank.subject.departmentId);
  for (const id of new Set(versionIds)) {
    const version = await prisma.analysisVersion.findFirst({ where: { id, questionBankAnalysis: { questionBankId: bankId } }, select: { id: true } });
    if (!version) throw new NotFoundError("Analysis version not found in this bank");
  }
}
