import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";

export const GET = withApiHandler(async () => {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { id: true, name: true, email: true } } },
  });
}, { responsibility: ["COE" as ResponsibilityType] });
