import { Classification, ConfidenceClassification } from "@prisma/client";

export function classifyIndex(value: number | null): Classification | null {
  if (value === null) return null;
  if (value >= 0.90) return "EXEMPLARY";
  if (value >= 0.80) return "HIGHLY_EFFECTIVE";
  if (value >= 0.70) return "EFFECTIVE";
  if (value >= 0.60) return "ACCEPTABLE";
  if (value >= 0.50) return "NEEDS_IMPROVEMENT";
  return "MAJOR_REVISION_REQUIRED";
}

export function classifyConfidence(score: number | null): ConfidenceClassification | null {
  if (score === null) return null;
  if (score >= 0.90) return "VERY_HIGH";
  if (score >= 0.80) return "HIGH";
  if (score >= 0.65) return "MEDIUM";
  if (score >= 0.50) return "LOW";
  return "VERY_LOW";
}

export function computeConfidence(verified: number, required: number): {
  score: number;
  percentage: number;
  classification: ConfidenceClassification;
} {
  const rawScore = required > 0 ? verified / required : 0;
  const score = Math.min(Math.max(rawScore, 0), 1);
  return {
    score,
    percentage: Math.round(score * 100),
    classification: classifyConfidence(score) ?? "VERY_LOW",
  };
}
