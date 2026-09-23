import { Classification, ConfidenceClassification } from "@prisma/client";

export function classifyIndex(value: number | null): Classification | null {
  if (value === null || !Number.isFinite(value) || value < 0 || value > 1) return null;
  if (value >= 0.90) return "EXEMPLARY";
  if (value >= 0.80) return "HIGHLY_EFFECTIVE";
  if (value >= 0.70) return "EFFECTIVE";
  if (value >= 0.60) return "ACCEPTABLE";
  if (value >= 0.50) return "NEEDS_IMPROVEMENT";
  return "MAJOR_REVISION_REQUIRED";
}

export function classifyConfidence(score: number | null): ConfidenceClassification | null {
  if (score === null || !Number.isFinite(score) || score < 0 || score > 1) return null;
  if (score >= 0.90) return "VERY_HIGH";
  if (score >= 0.80) return "HIGH";
  if (score >= 0.65) return "MEDIUM";
  if (score >= 0.50) return "LOW";
  return "VERY_LOW";
}

export function computeConfidence(verified: number, required: number): {
  score: number | null;
  percentage: number | null;
  classification: ConfidenceClassification | null;
} {
  const score = Number.isFinite(verified) && Number.isFinite(required) &&
    required > 0 && verified >= 0 && verified <= required ? verified / required : null;
  return {
    score,
    percentage: score === null ? null : Math.round(score * 100),
    classification: classifyConfidence(score),
  };
}
