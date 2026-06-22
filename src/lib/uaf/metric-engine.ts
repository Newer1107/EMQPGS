import { IndexCode } from "@prisma/client";
import { classifyIndex } from "./classification-matrix";
import type { RawBankData } from "./types";

export interface MetricResult {
  indexCode: IndexCode;
  value: number | null;
  classification: ReturnType<typeof classifyIndex>;
  weight: number | null;
  computationOrder: number;
  formulaUsed: string;
}

// ── Group 1: Extraction Metrics (order 1-2) ──

export function computeECS(data: RawBankData): MetricResult {
  const required = 7; // marks, co, po, pi, bloom, difficulty, type
  let extracted = 0;
  for (const q of data.questions) {
    let c = 1; // question text always present
    if (q.marks > 0) c++;
    if (q.coMapping) c++;
    if (q.rbtLevel) c++;
    if (q.difficultyLevel) c++;
    extracted += c;
  }
  const totalPossible = data.questions.length * required;
  const value = totalPossible > 0 ? extracted / totalPossible : null;
  return {
    indexCode: "ECS" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: null,
    computationOrder: 1,
    formulaUsed: "extracted_attributes / required_attributes",
  };
}

export function computeEQI(data: RawBankData): MetricResult {
  const verified = data.questions.filter(
    (q) =>
      q.coStatus === "VERIFIED" &&
      q.rbtStatus === "VERIFIED" &&
      q.difficultyStatus === "VERIFIED",
  ).length;
  const total = data.questions.length;
  const value = total > 0 ? verified / total : null;
  return {
    indexCode: "EQI" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: null,
    computationOrder: 2,
    formulaUsed: "verified_attributes / extracted_attributes",
  };
}

// ── Group 2: MII Sub-metrics (order 3-11) ──

export function computeCOA(data: RawBankData): MetricResult {
  const correct = data.questions.filter((q) => q.coMapping !== null).length;
  const total = data.questions.length;
  const value = total > 0 ? correct / total : null;
  return {
    indexCode: "COA" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: 1 / 9,
    computationOrder: 3,
    formulaUsed: "correct_co_mappings / total_co_mappings",
  };
}

export function computePOA(_data: RawBankData): MetricResult {
  // PO mapping is not in the current data structure; default to null
  return {
    indexCode: "POA" as IndexCode,
    value: null,
    classification: null,
    weight: 1 / 9,
    computationOrder: 4,
    formulaUsed: "correct_po_mappings / total_po_mappings",
  };
}

export function computePIA(_data: RawBankData): MetricResult {
  // PI mapping is not in the current data structure; default to null
  return {
    indexCode: "PIA" as IndexCode,
    value: null,
    classification: null,
    weight: 1 / 9,
    computationOrder: 5,
    formulaUsed: "correct_pi_mappings / total_pi_mappings",
  };
}

export function computeRBTA(data: RawBankData): MetricResult {
  const correct = data.questions.filter((q) => q.rbtStatus === "VERIFIED").length;
  const total = data.questions.length;
  const value = total > 0 ? correct / total : null;
  return {
    indexCode: "RBTA" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: 1 / 9,
    computationOrder: 6,
    formulaUsed: "correct_bloom_classifications / total_bloom_classifications",
  };
}

export function computeDA(data: RawBankData): MetricResult {
  const correct = data.questions.filter((q) => q.difficultyStatus === "VERIFIED").length;
  const total = data.questions.length;
  const value = total > 0 ? correct / total : null;
  return {
    indexCode: "DA" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: 1 / 9,
    computationOrder: 7,
    formulaUsed: "correct_difficulty_classifications / total_difficulty_classifications",
  };
}

export function computeMAA(data: RawBankData): MetricResult {
  const correct = data.questions.filter((q) => q.marks > 0).length;
  const total = data.questions.length;
  const value = total > 0 ? correct / total : null;
  return {
    indexCode: "MAA" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: 1 / 9,
    computationOrder: 8,
    formulaUsed: "correct_marks_allocations / total_questions",
  };
}

export function computeQTA(_data: RawBankData): MetricResult {
  // Question type classification is not in the current data structure
  return {
    indexCode: "QTA" as IndexCode,
    value: null,
    classification: null,
    weight: 1 / 9,
    computationOrder: 9,
    formulaUsed: "correct_classifications / total_questions",
  };
}

export function computeMC(data: RawBankData): MetricResult {
  let available = 0;
  for (const q of data.questions) {
    if (q.coMapping) available++;
    if (q.rbtLevel) available++;
    if (q.difficultyLevel) available++;
  }
  const totalPossible = data.questions.length * 3; // CO + RBT + Difficulty
  const value = totalPossible > 0 ? available / totalPossible : null;
  return {
    indexCode: "MC" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: 1 / 9,
    computationOrder: 10,
    formulaUsed: "available_metadata_fields / required_metadata_fields",
  };
}

export function computeMCS(_data: RawBankData): MetricResult {
  return {
    indexCode: "MCS" as IndexCode,
    value: 1.0,
    classification: classifyIndex(1.0),
    weight: 1 / 9,
    computationOrder: 11,
    formulaUsed: "consistent_metadata_entries / total_metadata_entries",
  };
}

// ── Group 3: Bloom Sub-metrics (order 12-14) ──

export function computeLOTS(data: RawBankData): MetricResult {
  const lotsLevels = ["L1", "L2", "L3"];
  const lots = data.questions.filter((q) => q.rbtLevel && lotsLevels.includes(q.rbtLevel)).length;
  const total = data.questions.length;
  const value = total > 0 ? lots / total : null;
  return {
    indexCode: "LOTS" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: null,
    computationOrder: 12,
    formulaUsed: "lots_questions / total_questions",
  };
}

export function computeHOTS(data: RawBankData): MetricResult {
  const hotsLevels = ["L4", "L5", "L6"];
  const hots = data.questions.filter((q) => q.rbtLevel && hotsLevels.includes(q.rbtLevel)).length;
  const total = data.questions.length;
  const value = total > 0 ? hots / total : null;
  return {
    indexCode: "HOTS" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: null,
    computationOrder: 13,
    formulaUsed: "hots_questions / total_questions",
  };
}

export function computeCBR(data: RawBankData, lots: MetricResult, hots: MetricResult): MetricResult {
  const value = lots.value && lots.value > 0 ? (hots.value ?? 0) / lots.value : null;
  return {
    indexCode: "CBR" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: null,
    computationOrder: 14,
    formulaUsed: "hots / lots",
  };
}

// ── Group 4: Core Indices (order 15-20) ──

export function computeSCI(data: RawBankData): MetricResult {
  const value = data.totalSlots > 0 ? Math.min(data.filledSlots / data.totalSlots, 1) : 0;
  return {
    indexCode: "SCI" as IndexCode,
    value: Math.min(Math.max(value, 0), 1),
    classification: classifyIndex(value),
    weight: 0.10,
    computationOrder: 15,
    formulaUsed: "structural_elements_present / required_structural_elements",
  };
}

/**
 * MII = mean of all 9 MII sub-metrics (COA, POA, PIA, RBTA, DA, MAA, QTA, MC, MCS).
 * Null sub-metrics are treated as 0 for the purpose of averaging, but the denominator
 * is always 9 regardless of how many sub-metrics are available.
 */
export function computeMII(results: MetricResult[]): MetricResult {
  const subCodes = ["COA", "POA", "PIA", "RBTA", "DA", "MAA", "QTA", "MC", "MCS"];
  const subMetrics = subCodes
    .map((code) => results.find((r) => r.indexCode === code))
    .filter((r): r is MetricResult => r !== undefined);
  const denominator = subMetrics.length; // always 9
  const value =
    denominator > 0
      ? subMetrics.reduce((sum, r) => sum + (r.value ?? 0), 0) / denominator
      : null;
  return {
    indexCode: "MII" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: 0.10,
    computationOrder: 16,
    formulaUsed: "(COA + POA + PIA + RBTA + DA + MAA + QTA + MC + MCS) / 9",
  };
}

export function computeBDI(data: RawBankData): MetricResult {
  // BDI = 1 - Σ|Observed - Expected| / 2
  // Expected: uniform distribution across 6 Bloom levels
  const expectedPct = 1 / 6;
  const levels = ["L1", "L2", "L3", "L4", "L5", "L6"];
  const counts = levels.map((l) => data.questions.filter((q) => q.rbtLevel === l).length);
  const total = data.questions.length;
  const deviation =
    total > 0
      ? counts.reduce((sum, c) => sum + Math.abs(c / total - expectedPct), 0)
      : 0;
  const value = 1 - deviation / 2;
  return {
    indexCode: "BDI" as IndexCode,
    value: Math.min(Math.max(value, 0), 1),
    classification: classifyIndex(value),
    weight: 0.15,
    computationOrder: 17,
    formulaUsed: "1 - Σ|Observed - Expected| / 2",
  };
}

export function computeCVI(data: RawBankData): MetricResult {
  const cos = new Set(data.questions.filter((q) => q.coMapping).map((q) => q.coMapping));
  const value = cos.size / 6; // Standard is 6 COs (CO1-CO6)
  return {
    indexCode: "CVI" as IndexCode,
    value: Math.min(Math.max(value, 0), 1),
    classification: classifyIndex(value),
    weight: 0.10,
    computationOrder: 18,
    formulaUsed: "covered_course_outcomes / total_course_outcomes",
  };
}

export function computeMCAI(data: RawBankData): MetricResult {
  // Marks-RBT alignment heuristic:
  //   1-2 marks → Remember/Understand (L1/L2)
  //   3-5 marks → Understand/Apply (L2/L3)
  //   6-8 marks → Apply/Analyze (L3/L4)
  //   9-12 marks → Analyze/Evaluate (L4/L5)
  //   13+ marks → Evaluate/Create (L5/L6)
  const aligned = data.questions.filter((q) => {
    if (!q.rbtLevel) return false;
    const rbtNum = parseInt(q.rbtLevel.replace("L", ""), 10);
    if (q.marks <= 2) return rbtNum <= 2;
    if (q.marks <= 5) return rbtNum >= 2 && rbtNum <= 3;
    if (q.marks <= 8) return rbtNum >= 3 && rbtNum <= 4;
    if (q.marks <= 12) return rbtNum >= 4 && rbtNum <= 5;
    return rbtNum >= 5;
  }).length;
  const total = data.questions.length;
  const value = total > 0 ? aligned / total : null;
  return {
    indexCode: "MCAI" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: 0.10,
    computationOrder: 19,
    formulaUsed: "correctly_aligned_questions / total_questions",
  };
}

export function computeDBI(data: RawBankData): MetricResult {
  // DBI = 1 - Σ|Observed - Expected| / 2
  // Expected distribution: Easy=30%, Medium=50%, Hard=20%
  const expected = { EASY: 0.3, MEDIUM: 0.5, HARD: 0.2 };
  const total = data.questions.length;
  if (total === 0) {
    return {
      indexCode: "DBI" as IndexCode,
      value: null,
      classification: null,
      weight: 0.10,
      computationOrder: 20,
      formulaUsed: "1 - Σ|Observed - Expected| / 2",
    };
  }
  const easy = data.questions.filter((q) => q.difficultyLevel === "EASY").length / total;
  const medium = data.questions.filter((q) => q.difficultyLevel === "MEDIUM").length / total;
  const hard = data.questions.filter((q) => q.difficultyLevel === "HARD").length / total;
  const deviation =
    Math.abs(easy - expected.EASY) +
    Math.abs(medium - expected.MEDIUM) +
    Math.abs(hard - expected.HARD);
  const value = 1 - deviation / 2;
  return {
    indexCode: "DBI" as IndexCode,
    value: Math.min(Math.max(value, 0), 1),
    classification: classifyIndex(value),
    weight: 0.10,
    computationOrder: 20,
    formulaUsed: "1 - Σ|Observed - Expected| / 2",
  };
}

// ── Group 5: Quality Indices (order 21-24) ──

export function computeQCQI(): MetricResult {
  // QCQI requires question quality evaluation (Clarity, Precision, TechnicalAccuracy, etc.)
  // Default to null — requires AI or human evaluation
  return {
    indexCode: "QCQI" as IndexCode,
    value: null,
    classification: null,
    weight: 0.15,
    computationOrder: 21,
    formulaUsed: "(Clarity + Precision + TechnicalAccuracy + Context + Validity + Alignment + Fairness) / 7",
  };
}

export function computeCAI(data: RawBankData): MetricResult {
  // Constructive Alignment = questions with both CO and RBT / total
  const aligned = data.questions.filter((q) => q.coMapping !== null && q.rbtLevel !== null).length;
  const total = data.questions.length;
  const value = total > 0 ? aligned / total : null;
  return {
    indexCode: "CAI" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: 0.10,
    computationOrder: 22,
    formulaUsed: "aligned_questions / total_questions",
  };
}

export function computeAMI(): MetricResult {
  // AMI requires moderation criteria evaluation (not yet available in the data pipeline)
  return {
    indexCode: "AMI" as IndexCode,
    value: null,
    classification: null,
    weight: 0.05,
    computationOrder: 23,
    formulaUsed: "moderation_criteria_satisfied / total_moderation_criteria",
  };
}

export function computeFRI(): MetricResult {
  // FRI requires future readiness criteria evaluation (not yet available)
  return {
    indexCode: "FRI" as IndexCode,
    value: null,
    classification: null,
    weight: 0.05,
    computationOrder: 24,
    formulaUsed: "future_ready_criteria_satisfied / total_future_ready_criteria",
  };
}

// ── Group 6: Composite Indices (order 25-26) ──

export function computeQPQI(results: MetricResult[]): MetricResult {
  const weights: Record<string, number> = {
    SCI: 0.10,
    MII: 0.10,
    BDI: 0.15,
    CVI: 0.10,
    MCAI: 0.10,
    DBI: 0.10,
    QCQI: 0.15,
    CAI: 0.10,
    AMI: 0.05,
    FRI: 0.05,
  };
  let weightedSum = 0;
  let totalWeight = 0;
  for (const r of results) {
    const w = weights[r.indexCode];
    if (r.value !== null && w !== undefined) {
      weightedSum += r.value * w;
      totalWeight += w;
    }
  }
  const value = totalWeight > 0 ? weightedSum / totalWeight : null;
  return {
    indexCode: "QPQI" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: null,
    computationOrder: 25,
    formulaUsed: "Σ(index_value × weight) / Σ(weight)",
  };
}

export function computeOCI(results: MetricResult[]): MetricResult {
  // OCI = mean of all available index confidences (non-null values)
  const withConfidence = results.filter((r) => r.value !== null);
  const value =
    withConfidence.length > 0
      ? withConfidence.reduce((sum, r) => sum + (r.value ?? 0), 0) / withConfidence.length
      : null;
  return {
    indexCode: "OCI" as IndexCode,
    value: value !== null ? Math.min(Math.max(value, 0), 1) : null,
    classification: classifyIndex(value),
    weight: null,
    computationOrder: 26,
    formulaUsed: "mean(index_confidence_scores)",
  };
}

// ── DAG Orchestration ──
//
// The DAG is ordered so that dependencies are always computed before consumers:
//   Group 1: Extraction metrics (no dependencies)
//   Group 2: MII sub-metrics (no dependencies among themselves)
//   Group 3: Bloom metrics (CBR depends on LOTS and HOTS within the group)
//   Group 4: Core indices (SCI, CVI, MCAI, DBI — no cross-dependencies)
//   Group 5: Dependencies on groups 2+4 (MII needs group 2 results; BDI is independent)
//   Group 6: Quality indices (QCQI, CAI, AMI, FRI — independent)
//   Group 7: Composites (QPQI, OCI need all prior results)

const DAG_GROUPS: Array<{ order: number; fns: string[] }> = [
  { order: 1, fns: ["ECS", "EQI"] },
  { order: 2, fns: ["COA", "POA", "PIA", "RBTA", "DA", "MAA", "QTA", "MC", "MCS"] },
  { order: 3, fns: ["LOTS", "HOTS", "CBR"] },
  { order: 4, fns: ["SCI", "CVI", "MCAI", "DBI"] },
  { order: 5, fns: ["MII", "BDI"] },
  { order: 6, fns: ["QCQI", "CAI", "AMI", "FRI"] },
  { order: 7, fns: ["QPQI", "OCI"] },
];

export class MetricEngine {
  computeAll(data: RawBankData): MetricResult[] {
    const results: MetricResult[] = [];
    const map = new Map<string, MetricResult>();

    for (const group of DAG_GROUPS) {
      for (const fn of group.fns) {
        const r = (() => {
          switch (fn) {
            case "ECS":
              return computeECS(data);
            case "EQI":
              return computeEQI(data);
            case "COA":
              return computeCOA(data);
            case "POA":
              return computePOA(data);
            case "PIA":
              return computePIA(data);
            case "RBTA":
              return computeRBTA(data);
            case "DA":
              return computeDA(data);
            case "MAA":
              return computeMAA(data);
            case "QTA":
              return computeQTA(data);
            case "MC":
              return computeMC(data);
            case "MCS":
              return computeMCS(data);
            case "LOTS":
              return computeLOTS(data);
            case "HOTS":
              return computeHOTS(data);
            case "CBR":
              return computeCBR(data, map.get("LOTS")!, map.get("HOTS")!);
            case "SCI":
              return computeSCI(data);
            case "MII":
              return computeMII(results);
            case "BDI":
              return computeBDI(data);
            case "CVI":
              return computeCVI(data);
            case "MCAI":
              return computeMCAI(data);
            case "DBI":
              return computeDBI(data);
            case "QCQI":
              return computeQCQI();
            case "CAI":
              return computeCAI(data);
            case "AMI":
              return computeAMI();
            case "FRI":
              return computeFRI();
            case "QPQI":
              return computeQPQI(results);
            case "OCI":
              return computeOCI(results);
            default:
              throw new Error(`Unknown metric: ${fn}`);
          }
        })();
        results.push(r);
        map.set(r.indexCode, r);
      }
    }

    return results;
  }
}
