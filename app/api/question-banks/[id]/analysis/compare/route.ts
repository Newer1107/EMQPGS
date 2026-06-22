import { ResponsibilityType } from "@prisma/client";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/db";
import { z } from "zod";

const compareSchema = z.object({
  v1: z.string().min(1),
  v2: z.string().min(1),
});

export const GET = withApiHandler(async (request) => {
  const { searchParams } = request.nextUrl;
  const params = compareSchema.parse({
    v1: searchParams.get("v1"),
    v2: searchParams.get("v2"),
  });

  const [v1Metrics, v2Metrics] = await Promise.all([
    prisma.uAFMetric.findMany({
      where: { questionBankAnalysis: { versions: { some: { id: params.v1 } } } },
    }),
    prisma.uAFMetric.findMany({
      where: { questionBankAnalysis: { versions: { some: { id: params.v2 } } } },
    }),
  ]);

  const deltas = v1Metrics.map((m1) => {
    const m2 = v2Metrics.find((m) => m.indexCode === m1.indexCode);
    const oldV = m1.value;
    const newV = m2?.value ?? null;
    const delta = oldV !== null && newV !== null ? newV - oldV : null;
    return {
      indexCode: m1.indexCode,
      oldValue: oldV,
      newValue: newV,
      delta,
      direction: delta === null ? "unchanged" as const : delta > 0 ? "improved" as const : delta < 0 ? "declined" as const : "unchanged" as const,
    };
  });

  return { deltas };
}, { responsibility: ["DEAN" as ResponsibilityType, "COORDINATOR" as ResponsibilityType] });
