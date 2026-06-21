import type { QuestionLibraryItem, QuestionUsageHistory } from "@prisma/client";
import type { PaperSolution, EvaluationProfile, GenerationTrace } from "./types";
import { DEFAULT_TCET_PROFILE } from "./types";
import { CandidateBuilder } from "./candidate-builder";
import { ConstraintEngine } from "./constraint-engine";
import { EvaluationEngine } from "./evaluation-engine";
import type { SearchStrategy } from "./strategies/types";

export class PaperGenerationEngine {
  private readonly profile: EvaluationProfile;

  constructor(
    private readonly config: {
      moduleRange: number[];
      enforceUsageHistory?: boolean;
      enforceConceptDiversity?: boolean;
    },
    private readonly strategy: SearchStrategy,
    profile?: EvaluationProfile,
  ) {
    this.profile = profile ?? DEFAULT_TCET_PROFILE;
  }

  generate(
    inventory: Map<string, QuestionLibraryItem[]>,
    usageHistory: QuestionUsageHistory[],
    variant: string,
  ): { solution: PaperSolution; trace: GenerationTrace } {
    const startTime = Date.now();

    const builder = new CandidateBuilder(
      {
        moduleRange: this.config.moduleRange,
        excludeUsed: this.config.enforceUsageHistory ?? true,
        consumedInRun: new Set(),
      },
      inventory,
    );

    const constraintEngine = new ConstraintEngine({
      moduleRange: this.config.moduleRange,
      enforceUsageHistory: this.config.enforceUsageHistory ?? true,
      enforceConceptDiversity: this.config.enforceConceptDiversity ?? true,
    });

    const evalEngine = new EvaluationEngine(this.profile, usageHistory);

    const slots = builder.buildSlots();

    const bankState = constraintEngine.validateBankState(slots, inventory);
    if (!bankState.valid) {
      const msgs = bankState.violations.map((v) => `${v.rule}: ${v.message}`).join("; ");
      throw new Error(`Bank state validation failed: ${msgs}`);
    }

    const { solution, trace } = this.strategy.search(
      slots, builder, evalEngine, constraintEngine, usageHistory, variant,
    );

    const durationMs = Date.now() - startTime;
    trace.stats.durationMs = durationMs;
    trace.stats.generatedAt = new Date().toISOString();

    return { solution, trace };
  }
}
