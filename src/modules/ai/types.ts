export type CoverageMetric = {
  label: string;
  total: number;
  approved: number;
  missing: number;
};

export type DistributionMetric = {
  key: string;
  count: number;
  percentage: number;
};

export type AiQuestionBankReport = {
  moduleCoverage: CoverageMetric[];
  coDistribution: DistributionMetric[];
  rbtDistribution: DistributionMetric[];
  difficultyDistribution: DistributionMetric[];
  duplicates: Array<{ questionId: string; similarToQuestionId: string; score: number }>;
  missingAreas: string[];
  qualityFindings: string[];
  bloomsBalance: string;
  inventory: {
    approvedQuestions: number;
    remainingWarning: boolean;
    remainingCritical: boolean;
    exhausted: boolean;
  };
  executiveSummary: string;
  chartData: {
    moduleCoverage: Array<{ module: string; approved: number; target: number }>;
    coDistribution: Array<{ label: string; value: number }>;
    rbtDistribution: Array<{ label: string; value: number }>;
    difficultyDistribution: Array<{ label: string; value: number }>;
  };
};
