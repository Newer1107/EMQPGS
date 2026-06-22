import { prisma } from "@/lib/db";
import type { EvidenceSnapshotData, StructuredPrompts, ModulePrompt } from "./types";

export class PromptBuilder {
  /**
   * Builds structured prompts for all AI modules from the evidence snapshot.
   * Loads active prompt versions from the PromptVersion table.
   */
  async build(snapshot: EvidenceSnapshotData): Promise<StructuredPrompts> {
    const activeVersions = await prisma.promptVersion.findMany({
      where: { supersededAt: null },
    });

    if (activeVersions.length === 0) {
      throw new Error("No active prompt versions found. Run seed data first.");
    }

    // Find the system preamble
    const preamble = activeVersions.find((v) => v.moduleId === "SYSTEM_PREAMBLE");

    const modules: ModulePrompt[] = [];
    let totalTokens = 0;

    for (const version of activeVersions) {
      if (version.moduleId === "SYSTEM_PREAMBLE") continue;

      const evidenceJSON = this.buildEvidenceForModule(version.moduleId as string, snapshot);
      let promptText = version.promptText;

      // Replace {{evidence}} placeholder with actual data
      promptText = promptText.replace("{evidence}", evidenceJSON);

      // Prepend system preamble if exists
      if (preamble) {
        promptText = preamble.promptText + "\n\n---\n\n" + promptText;
      }

      const tokens = this.estimateTokens(promptText);
      totalTokens += tokens;

      modules.push({
        moduleId: version.moduleId,
        promptText,
        promptVersionId: version.id,
        contextBudget: version.contextBudget ?? 4000,
        outputSchema: (version.outputSchema as Record<string, unknown>) ?? {},
      });
    }

    return { modules, totalEstimatedTokens: totalTokens };
  }

  /**
   * Builds module-specific evidence JSON — only sends what each module needs.
   */
  private buildEvidenceForModule(moduleId: string, snapshot: EvidenceSnapshotData): string {
    const base = {
      totalQuestions: snapshot.totalQuestions,
      extractionCompleteness: snapshot.extractionCompletenessScore,
    };

    switch (moduleId) {
      case "EXECUTIVE_SUMMARY":
        return JSON.stringify({
          ...base,
          metrics: snapshot.metrics,
          distributions: snapshot.distributions,
          detectedRisks: snapshot.detectedRisks,
        });

      case "BLOOM_ANALYSIS":
        return JSON.stringify({
          ...base,
          bloomDistribution: snapshot.distributions.bloom,
          bdi: snapshot.metrics["BDI"],
          lots: snapshot.metrics["LOTS"],
          hots: snapshot.metrics["HOTS"],
          cbr: snapshot.metrics["CBR"],
        });

      case "DIFFICULTY_ANALYSIS":
        return JSON.stringify({
          ...base,
          difficultyDistribution: snapshot.distributions.difficulty,
          dbi: snapshot.metrics["DBI"],
          mcai: snapshot.metrics["MCAI"],
        });

      case "CO_COVERAGE":
        return JSON.stringify({
          ...base,
          coDistribution: snapshot.distributions.coCoverage,
          cvi: snapshot.metrics["CVI"],
        });

      case "MODULE_COVERAGE":
        return JSON.stringify({
          ...base,
          moduleDistribution: snapshot.distributions.moduleCoverage,
        });

      case "CONCEPT_DIVERSITY":
        return JSON.stringify({
          ...base,
          questionCount: snapshot.totalQuestions,
        });

      case "RISK_ANALYSIS":
        return JSON.stringify({
          ...base,
          detectedRisks: snapshot.detectedRisks,
          metrics: snapshot.metrics,
        });

      case "RECOMMENDATIONS":
        return JSON.stringify({
          ...base,
          detectedRisks: snapshot.detectedRisks,
          metrics: snapshot.metrics,
        });

      case "ACADEMIC_QUALITY":
        return JSON.stringify({
          ...base,
          qcqi: snapshot.metrics["QCQI"],
        });

      case "FINAL_VERDICT":
        return JSON.stringify({
          ...base,
          qpqi: snapshot.metrics["QPQI"],
          oci: snapshot.metrics["OCI"],
          metrics: snapshot.metrics,
        });

      default:
        return JSON.stringify(base);
    }
  }

  /**
   * Rough token estimation: ~4 characters per token for mixed text/JSON.
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
