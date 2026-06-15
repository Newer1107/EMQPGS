import { QuestionBankPhase } from "@prisma/client";
import { prisma } from "@/lib/db";

export interface ReadinessAssessment {
  ready: boolean;
  phase: QuestionBankPhase;
  targetPhase: QuestionBankPhase;
  issues: string[];
  warnings: string[];
}

export class ReadinessEngine {
  async isReady(questionBankId: string, targetPhase: QuestionBankPhase): Promise<ReadinessAssessment> {
    const bank = await prisma.questionBank.findUnique({
      where: { id: questionBankId },
      include: {
        pattern: true,
        slots: {
          where: { assignedQuestionId: { not: null } },
          include: {
            assignedQuestion: {
              include: { moderationEvents: true },
            },
          },
        },
        aiReports: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!bank) {
      return { ready: false, phase: targetPhase, targetPhase, issues: ["Question bank not found"], warnings: [] };
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    const totalSlots = bank.pattern?.totalSlots ?? 126;
    const filledSlots = bank.slots.length;

    switch (targetPhase) {
      case QuestionBankPhase.MODERATION: {
        const emptySlots = totalSlots - filledSlots;
        if (emptySlots > 0) {
          issues.push(`${emptySlots} of ${totalSlots} slots have no question assigned.`);
        }
        break;
      }

      case QuestionBankPhase.APPROVAL: {
        if (filledSlots === 0) {
          issues.push("No questions assigned to any slot.");
        }

        const unmoderated = bank.slots.filter(
          (slot) => slot.assignedQuestion && slot.assignedQuestion.moderationEvents.length === 0,
        );
        if (unmoderated.length > 0) {
          issues.push(`${unmoderated.length} questions have no moderation decision.`);
        }

        const latestAiReport = bank.aiReports[0];
        if (!latestAiReport || latestAiReport.status !== "COMPLETED") {
          issues.push("AI report not generated or not completed.");
        }

        // Coverage warnings
        const cosCovered = new Set(bank.slots.map((s) => s.assignedQuestion?.coMapping).filter(Boolean));
        const rbtLevelsCovered = new Set(bank.slots.map((s) => s.assignedQuestion?.rbtLevel).filter(Boolean));
        if (cosCovered.size < 3) {
          warnings.push(`Only ${cosCovered.size} COs represented (minimum 3 recommended).`);
        }
        if (rbtLevelsCovered.size < 3) {
          warnings.push(`Only ${rbtLevelsCovered.size} RBT levels represented (minimum 3 recommended).`);
        }
        break;
      }

      case QuestionBankPhase.COMPLETE: {
        // Coordinator decision gates this — engine not involved
        break;
      }

      default: {
        issues.push(`Unknown target phase: ${targetPhase}`);
      }
    }

    return {
      ready: issues.length === 0,
      phase: bank.phase,
      targetPhase,
      issues,
      warnings,
    };
  }
}
