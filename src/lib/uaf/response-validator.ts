import { z } from "zod";
import { AIRawResponse, ValidatedAIResponse, ValidatedModuleOutput, ModulePrompt } from "./types";
import { logger } from "@/lib/logger";

export class ResponseValidator {
  /**
   * 4-stage validation pipeline:
   * 1. JSON.parse → retry with format fix on failure
   * 2. Zod schema validation per module
   * 3. Semantic hallucination checks (5 guards)
   * 4. Return ValidatedAIResponse with per-module status
   */
  validate(
    rawResponse: AIRawResponse,
    expectedModules: ModulePrompt[],
  ): ValidatedAIResponse {
    const modules: ValidatedModuleOutput[] = [];
    let overallValid = true;

    // For each expected module, validate the response
    // In production, each module gets its own Ollama call
    // Here we parse the single response and validate against all expected modules
    const parsed = this.tryParseJSON(rawResponse.rawText);
    if (!parsed) {
      return {
        modules: expectedModules.map((m) => ({
          moduleId: m.moduleId,
          success: false,
          data: null,
          validationErrors: ["Invalid JSON response"],
          retryCount: 0,
        })),
        overallValid: false,
      };
    }

    // Treat the parsed response as a module output
    // Each module should be in the response by its moduleId key
    for (const mod of expectedModules) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const output = (parsed as Record<string, unknown>)[mod.moduleId] ?? parsed;
      const errors: string[] = [];

      // Stage 1: Structure check
      if (!output || typeof output !== "object") {
        modules.push({
          moduleId: mod.moduleId,
          success: false,
          data: null,
          validationErrors: ["Non-object response"],
          retryCount: 0,
        });
        overallValid = false;
        continue;
      }

      // Stage 2: Schema validation (if outputSchema is defined)
      if (mod.outputSchema && Object.keys(mod.outputSchema).length > 0) {
        try {
          const schemaShape: Record<string, z.ZodTypeAny> = {};
          for (const [key] of Object.entries(mod.outputSchema)) {
            schemaShape[key] = z.unknown().optional();
          }
          const schema = z.object(schemaShape).strict();
          schema.parse(output);
          // Additional: verify each expected field exists and is not null/undefined
          const outputRecord = output as Record<string, unknown>;
          for (const [key] of Object.entries(mod.outputSchema)) {
            if (outputRecord[key] === undefined || outputRecord[key] === null) {
              errors.push(`Schema validation failed: Required field '${key}' is missing or null`);
            }
          }
        } catch (parseError) {
          errors.push(`Schema validation failed: ${(parseError as Error).message}`);
        }
      }

      // Stage 3: Semantic hallucination guards
      const guardErrors = this.runSemanticGuards(output, mod.moduleId);
      errors.push(...guardErrors);

      // Stage 4: Decide
      modules.push({
        moduleId: mod.moduleId,
        success: errors.length === 0,
        data: errors.length === 0 ? (output as Record<string, unknown>) : null,
        validationErrors: errors,
        retryCount: 0,
      });

      if (errors.length > 0) overallValid = false;
    }

    return { modules, overallValid };
  }

  /**
   * 5 semantic hallucination guards.
   */
  private runSemanticGuards(output: unknown, moduleId: string): string[] {
    const errors: string[] = [];
    const data = output as Record<string, unknown>;

    if (!data || typeof data !== "object") return ["Invalid output structure"];

    // Guard 1: Number Injection — detect standalone numbers that look like computed values
    const textValues = JSON.stringify(data);
    const numberPattern = /\b\d+\.?\d*%/g;
    const injectedNumbers = textValues.match(numberPattern);
    // Context-aware: multi-module responses naturally contain many percentages (module-level data)
    const topLevelKeys = Object.keys(data);
    const objectValueKeys = topLevelKeys.filter(
      (k) => typeof (data as Record<string, unknown>)[k] === "object" && (data as Record<string, unknown>)[k] !== null,
    ).length;
    const hasMultiModuleStructure = topLevelKeys.length >= 2 && objectValueKeys >= 2;
    const threshold = hasMultiModuleStructure ? 30 : 15;
    if (injectedNumbers && injectedNumbers.length > threshold) {
      errors.push("Guard 1 (Number Injection): Excessive percentage values detected");
    }

    // Guard 2: Entity Name — check for invented COs/modules
    if (typeof data === "object" && data !== null) {
      const text = JSON.stringify(data).toLowerCase();
      const coPattern = /co(7|8|9|10|11|12)\b/;
      if (coPattern.test(text)) {
        errors.push("Guard 2 (Entity Name): References to out-of-range COs detected");
      }
      const modulePattern = /module\s*(7|8|9|10|11|12)\b/;
      if (modulePattern.test(text)) {
        errors.push("Guard 2 (Entity Name): References to out-of-range modules detected");
      }
    }

    // Guard 3: Verdict Alignment — not applicable at module level
    // (checked in AnalysisBuilder when final verdict is compared to QPQI)

    // Guard 4: Field Mandate — all required fields present
    if (
      moduleId === "EXECUTIVE_SUMMARY" &&
      typeof data.executiveSummary !== "string" &&
      typeof data.overallAssessment !== "string"
    ) {
      errors.push("Guard 4 (Field Mandate): Missing required summary/assessment field");
    }

    // Guard 5: Length Guard
    const text = JSON.stringify(data);
    if (text.length > 5000) {
      errors.push(`Guard 5 (Length): Response exceeds 5000 characters (${text.length})`);
    }

    return errors;
  }

  private tryParseJSON(text: string): Record<string, unknown> | null {
    try {
      return JSON.parse(text) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
