import { z } from "zod";
import { AIRawResponse, ValidatedAIResponse, ValidatedModuleOutput, ModulePrompt } from "./types";
import { FinalVerdict, RiskPriority, RiskType } from "@prisma/client";

const text = z.string().min(1);
const priority = z.enum(RiskPriority);
const moduleSchemas: Record<string, z.ZodTypeAny> = {
  EXECUTIVE_SUMMARY: z.object({ executiveSummary: text.optional(), overallAssessment: text.optional(),
    strengths: z.array(z.object({ id: text, strength: text })).optional(),
    weaknesses: z.array(z.object({ id: text, weakness: text })).optional(),
  }).passthrough().refine((d) => !!(d.executiveSummary || d.overallAssessment)),
  BLOOM_ANALYSIS: z.object({ cognitiveBalance: z.array(text), risks: z.array(text), recommendations: z.array(text) }).passthrough(),
  DIFFICULTY_ANALYSIS: z.object({ difficultyAssessment: text, rigorLevel: text, marksAlignment: z.array(text) }).passthrough(),
  CO_COVERAGE: z.object({ coverageStatus: text, weakOutcomes: z.array(text), attainmentRisk: z.array(text) }).passthrough(),
  MODULE_COVERAGE: z.object({ moduleAssessment: z.record(z.string(), text), weakModules: z.array(text), strongModules: z.array(text) }).passthrough(),
  CONCEPT_DIVERSITY: z.object({ diversityScore: z.enum(["HIGH", "MEDIUM", "LOW"]), clusteringRisk: text.nullable(), recommendation: text }).passthrough(),
  RISK_ANALYSIS: z.object({ risks: z.array(z.object({ finding: text, priority,
    riskType: z.enum(RiskType).nullable().optional(), evidenceReference: text.optional(),
    educationalRisk: text.optional(), institutionalRisk: text.nullable().optional(),
    affectedModules: z.array(text).optional(), affectedCOs: z.array(text).optional(),
  }).passthrough()) }).passthrough(),
  RECOMMENDATIONS: z.object({ recommendations: z.array(z.object({ finding: text, recommendation: text, priority,
    impact: text.nullable().optional(), suggestedActions: z.array(text).optional(), evidenceReference: text.optional(),
  }).passthrough()) }).passthrough(),
  ACADEMIC_QUALITY: z.object({ qualityAssessment: text, strongDimensions: z.array(text), weakDimensions: z.array(text), revisionCandidates: z.array(text) }).passthrough(),
  FINAL_VERDICT: z.object({ verdict: z.enum(FinalVerdict) }).passthrough(),
};

function fieldSchema(spec: unknown): z.ZodTypeAny {
  if (typeof spec === "string") {
    if (spec === "string") return z.string();
    if (spec === "number") return z.number();
    if (spec === "boolean") return z.boolean();
    if (spec === "array") return z.array(z.unknown());
    if (spec.endsWith("[]")) return z.array(fieldSchema(spec.slice(0, -2)));
    if (spec === "object") return z.record(z.string(), z.unknown());
    throw new Error(`Unsupported schema descriptor: ${spec}`);
  }
  if (spec && typeof spec === "object") {
    const s = spec as Record<string, unknown>;
    if (Array.isArray(s.enum)) return z.custom((v) => s.enum instanceof Array && s.enum.includes(v));
    if (s.type === "array") return z.array(fieldSchema(s.items));
    if (s.type === "object" || s.properties) {
      const required = Array.isArray(s.required) ? s.required : [];
      const shape = Object.fromEntries(Object.entries((s.properties ?? {}) as Record<string, unknown>).map(([k, v]) =>
        [k, required.includes(k) ? fieldSchema(v) : fieldSchema(v).optional()]));
      return s.additionalProperties === false ? z.object(shape).strict() : z.object(shape).passthrough();
    }
    return fieldSchema(s.type);
  }
  throw new Error("Unsupported output schema");
}

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
      const output = Object.prototype.hasOwnProperty.call(parsed, mod.moduleId)
        ? parsed[mod.moduleId] : expectedModules.length === 1 ? parsed : undefined;
      const errors: string[] = [];

      // Stage 1: Structure check
      if (!output || typeof output !== "object" || Array.isArray(output)) {
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
          const schema = mod.outputSchema.type === "object" || mod.outputSchema.properties
            ? fieldSchema(mod.outputSchema)
            : z.object(Object.fromEntries(Object.entries(mod.outputSchema).map(([k, v]) => [k, fieldSchema(v)]))).strict();
          schema.parse(output);
        } catch (parseError) {
          errors.push(`Schema validation failed: ${(parseError as Error).message}`);
        }
      }

      // Seeded prompts may have no stored outputSchema. Enforce their contracts,
      // and always protect the fields that feed relational persistence.
      const builtIn = moduleSchemas[mod.moduleId];
      if (builtIn && (!Object.keys(mod.outputSchema ?? {}).length ||
        ["EXECUTIVE_SUMMARY", "RISK_ANALYSIS", "RECOMMENDATIONS", "FINAL_VERDICT"].includes(mod.moduleId))) {
        const checked = builtIn.safeParse(output);
        if (!checked.success) errors.push(`Schema validation failed: ${checked.error.message}`);
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
      const parsed: unknown = JSON.parse(text);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
}
