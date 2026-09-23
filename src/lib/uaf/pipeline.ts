import { EVALUATION_ENGINE_VERSION, EVALUATION_SCHEMA_VERSION } from "@/lib/evaluation/types";

/** Explicit supported engine/schema pairs; unknown origins are not UAF. */
export const UAF_ANALYSIS_FILTER = {
  OR: [
    { evaluationEngineVersion: "1.0.0", analysisSchemaVersion: "1.0.0" },
    { evaluationEngineVersion: "1.1.0", analysisSchemaVersion: "1.1.0" },
  ],
};

export const EVALUATION_ANALYSIS_FILTER = {
  evaluationEngineVersion: EVALUATION_ENGINE_VERSION,
  analysisSchemaVersion: EVALUATION_SCHEMA_VERSION,
};

export type AnalysisPipeline = "uaf" | "evaluation";

export function pipelineFilter(pipeline: AnalysisPipeline) {
  return pipeline === "uaf" ? UAF_ANALYSIS_FILTER : EVALUATION_ANALYSIS_FILTER;
}
