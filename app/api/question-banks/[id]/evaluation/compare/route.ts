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

  const [v1Snapshot, v2Snapshot] = await Promise.all([
    prisma.analysisSnapshot.findUnique({ where: { analysisVersionId: params.v1 } }),
    prisma.analysisSnapshot.findUnique({ where: { analysisVersionId: params.v2 } }),
  ]);

  if (!v1Snapshot?.fullReport || !v2Snapshot?.fullReport) {
    return { deltas: [], error: "One or both versions have no report data." };
  }

  const r1 = v1Snapshot.fullReport as Record<string, unknown>;
  const r2 = v2Snapshot.fullReport as Record<string, unknown>;

  // Compare consolidated scores
  const s1 = ((r1.consolidatedScores ?? []) as Array<{ moduleNumber: number; average: number }>);
  const s2 = ((r2.consolidatedScores ?? []) as Array<{ moduleNumber: number; average: number }>);

  const deltas = s1.map((m1) => {
    const m2 = s2.find((m) => m.moduleNumber === m1.moduleNumber);
    const oldV = m1.average;
    const newV = m2?.average ?? null;
    const delta = oldV !== null && newV !== null ? newV - oldV : null;
    return {
      moduleNumber: m1.moduleNumber,
      metric: "average",
      oldValue: oldV,
      newValue: newV,
      delta,
      direction: delta === null ? "unchanged" as const : delta > 0 ? "improved" as const : delta < 0 ? "declined" as const : "unchanged" as const,
    };
  });

  // Compare overall average
  const ov1 = (r1.overallAverage as number) ?? 0;
  const ov2 = (r2.overallAverage as number) ?? 0;
  const ovDelta = ov2 - ov1;

  // Compare verdicts
  const v1 = (r1.verdict as { verdict: string })?.verdict ?? "N/A";
  const v2 = (r2.verdict as { verdict: string })?.verdict ?? "N/A";

  // Compare total findings
  const f1 = ((r1.questionFindings ?? []) as unknown[]).length;
  const f2 = ((r2.questionFindings ?? []) as unknown[]).length;

  return {
    versionA: { id: params.v1, overallAverage: ov1, verdict: v1, findingsCount: f1 },
    versionB: { id: params.v2, overallAverage: ov2, verdict: v2, findingsCount: f2 },
    deltas,
    overallDelta: { oldValue: ov1, newValue: ov2, delta: ovDelta, direction: ovDelta > 0 ? "improved" as const : ovDelta < 0 ? "declined" as const : "unchanged" as const },
  };
}, { responsibility: ["COORDINATOR" as ResponsibilityType] });
