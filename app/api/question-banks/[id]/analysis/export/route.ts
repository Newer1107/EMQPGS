import { NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { DepartmentAccessUtils } from "@/modules/coordinator/department-utils";
import { exportUafPdf } from "@/modules/uaf-export/pdf";

export const runtime = "nodejs";
export const GET = withApiHandler(async (request, context) => {
  const bankId = request.nextUrl.pathname.split("/")[3]!;
  const bank = await prisma.questionBank.findUnique({ where: { id: bankId }, select: { subject: { select: { departmentId: true } } } });
  if (!bank) throw new NotFoundError("Question bank not found");
  await new DepartmentAccessUtils().assertDepartmentAccess(context.auth!, bank.subject.departmentId);
  const versionId = request.nextUrl.searchParams.get("versionId");
  const version = await prisma.analysisVersion.findFirst({
    where: { ...(versionId ? { id: versionId } : {}), questionBankAnalysis: { questionBankId: bankId, evaluationEngineVersion: { not: { startsWith: "eval-" } } } },
    orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }],
    include: { analysisSnapshot: true, evidenceSnapshot: true },
  });
  if (!version) throw new NotFoundError("Analysis version not found for this question bank");
  const pdf = await exportUafPdf(version);
  return new NextResponse(Buffer.from(pdf), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="uaf-report-v${version.versionNumber}.pdf"`,
    "X-Content-Type-Options": "nosniff",
  } });
}, { responsibility: ["DEAN", "COORDINATOR"], responseType: "raw" });
