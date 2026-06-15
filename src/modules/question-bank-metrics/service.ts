import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface SlotModuleBreakdown {
  moduleNumber: number;
  totalSlots: number;
  filledSlots: number;
  emptySlots: number;
  fillPercentage: number;
}

export interface SlotMarksBreakdown {
  marks: number;
  totalSlots: number;
  filledSlots: number;
  fillPercentage: number;
}

export interface ModerationStats {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  revisionRequested: number;
}

export interface CoverageDistribution {
  coDistribution: Record<string, number>;
  rbtDistribution: Record<string, number>;
  difficultyDistribution: Record<string, number>;
}

export interface QuestionBankMetrics {
  totalSlots: number;
  filledSlots: number;
  emptySlots: number;
  fillPercentage: number;
  byModule: SlotModuleBreakdown[];
  byMarks: SlotMarksBreakdown[];
  moderation: ModerationStats;
  coverage: CoverageDistribution;
}

export class QuestionBankMetricsService {
  async getMetrics(questionBankId: string): Promise<QuestionBankMetrics> {
    const [allSlots, filledSlots] = await Promise.all([
      prisma.questionSlot.findMany({
        where: { questionBankId },
        orderBy: [{ moduleNumber: "asc" }, { marks: "asc" }, { slotNumber: "asc" }],
      }),
      prisma.questionSlot.findMany({
        where: { questionBankId, assignedQuestionId: { not: null } },
        include: {
          assignedQuestion: {
            select: {
              status: true,
              coMapping: true,
              rbtLevel: true,
              difficultyLevel: true,
            },
          },
        },
      }),
    ]);

    const totalSlots = allSlots.length;
    const filledCount = filledSlots.length;
    const emptyCount = totalSlots - filledCount;

    const byModule = this.buildModuleBreakdown(allSlots, filledSlots);
    const byMarks = this.buildMarksBreakdown(allSlots, filledSlots);
    const moderation = this.buildModerationStats(filledSlots);
    const coverage = this.buildCoverageDistribution(filledSlots);

    return {
      totalSlots,
      filledSlots: filledCount,
      emptySlots: emptyCount,
      fillPercentage: totalSlots > 0 ? Math.round((filledCount / totalSlots) * 100) : 0,
      byModule,
      byMarks,
      moderation,
      coverage,
    };
  }

  private buildModuleBreakdown(
    allSlots: Array<{ moduleNumber: number }>,
    filledSlots: Array<{ moduleNumber: number }>,
  ): SlotModuleBreakdown[] {
    const moduleMap = new Map<number, { total: number; filled: number }>();
    for (const slot of allSlots) {
      const entry = moduleMap.get(slot.moduleNumber) ?? { total: 0, filled: 0 };
      entry.total += 1;
      moduleMap.set(slot.moduleNumber, entry);
    }
    for (const slot of filledSlots) {
      const entry = moduleMap.get(slot.moduleNumber);
      if (entry) entry.filled += 1;
    }
    return Array.from(moduleMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([moduleNumber, { total, filled }]) => ({
        moduleNumber,
        totalSlots: total,
        filledSlots: filled,
        emptySlots: total - filled,
        fillPercentage: total > 0 ? Math.round((filled / total) * 100) : 0,
      }));
  }

  private buildMarksBreakdown(
    allSlots: Array<{ marks: number }>,
    filledSlots: Array<{ marks: number }>,
  ): SlotMarksBreakdown[] {
    const marksMap = new Map<number, { total: number; filled: number }>();
    for (const slot of allSlots) {
      const entry = marksMap.get(slot.marks) ?? { total: 0, filled: 0 };
      entry.total += 1;
      marksMap.set(slot.marks, entry);
    }
    for (const slot of filledSlots) {
      const entry = marksMap.get(slot.marks);
      if (entry) entry.filled += 1;
    }
    return Array.from(marksMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([marks, { total, filled }]) => ({
        marks,
        totalSlots: total,
        filledSlots: filled,
        fillPercentage: total > 0 ? Math.round((filled / total) * 100) : 0,
      }));
  }

  private buildModerationStats(
    filledSlots: Array<{
      assignedQuestion: {
        status: string;
      } | null;
    }>,
  ): ModerationStats {
    const stats: ModerationStats = { total: filledSlots.length, approved: 0, pending: 0, rejected: 0, revisionRequested: 0 };
    for (const slot of filledSlots) {
      const status = slot.assignedQuestion?.status;
      if (status === "APPROVED") stats.approved += 1;
      else if (status === "PENDING") stats.pending += 1;
      else if (status === "REJECTED") stats.rejected += 1;
      else if (status === "REVISION_REQUESTED" || status === "REVISION_SUBMITTED") stats.revisionRequested += 1;
      else stats.pending += 1;
    }
    return stats;
  }

  private buildCoverageDistribution(
    filledSlots: Array<{
      assignedQuestion: {
        coMapping: string;
        rbtLevel: string;
        difficultyLevel: string | null;
      } | null;
    }>,
  ): CoverageDistribution {
    const coCount: Record<string, number> = {};
    const rbtCount: Record<string, number> = {};
    const difficultyCount: Record<string, number> = {};

    for (const slot of filledSlots) {
      const q = slot.assignedQuestion;
      if (q) {
        coCount[q.coMapping] = (coCount[q.coMapping] ?? 0) + 1;
        rbtCount[q.rbtLevel] = (rbtCount[q.rbtLevel] ?? 0) + 1;
        if (q.difficultyLevel) {
          difficultyCount[q.difficultyLevel] = (difficultyCount[q.difficultyLevel] ?? 0) + 1;
        }
      }
    }

    return {
      coDistribution: coCount,
      rbtDistribution: rbtCount,
      difficultyDistribution: difficultyCount,
    };
  }
}
