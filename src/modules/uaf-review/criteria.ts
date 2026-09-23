// Criterion identifiers mirror the UAF framework, not inferred text features.
export const ATTRIBUTES = ["questionId", "questionText", "marks", "coMapping", "poMapping", "piMapping", "rbtLevel", "difficultyLevel", "questionType"] as const;
export const QCQI_CRITERIA = ["clarity", "precision", "technicalAccuracy", "context", "validity", "alignment", "fairness"] as const;
export const AMI_CRITERIA = ["validity", "reliability", "fairness", "transparency", "traceability", "consistency", "governanceCompliance"] as const;
export const FRI_CRITERIA = ["hotsIntegration", "industryRelevance", "employabilitySkills", "problemSolving", "innovation", "criticalThinking", "graduateAttributes"] as const;
export const CAI_CRITERIA = ["coMappingValid", "bloomAppropriate", "learningEvidenceObservable", "intendedOutcomeMeasured"] as const;
export const SOURCE_TYPES = ["SYLLABUS", "RUBRIC", "MODERATION_RECORD", "COURSE_FILE", "POLICY", "OTHER_DOCUMENT"] as const;
export const LABELS: Record<string, string> = {
  questionId: "Question identifier", questionText: "Question text", marks: "Marks", coMapping: "CO mapping",
  poMapping: "PO mapping", piMapping: "PI mapping", rbtLevel: "Bloom level", difficultyLevel: "Difficulty", questionType: "Question type",
  clarity: "Clarity", precision: "Precision", technicalAccuracy: "Technical accuracy", context: "Context adequacy",
  validity: "Assessment validity", alignment: "Question alignment", fairness: "Fairness", reliability: "Reliability",
  transparency: "Transparency", traceability: "Traceability", consistency: "Consistency", governanceCompliance: "Governance compliance",
  hotsIntegration: "HOTS integration", industryRelevance: "Industry relevance", employabilitySkills: "Employability skills",
  problemSolving: "Problem solving", innovation: "Innovation", criticalThinking: "Critical thinking", graduateAttributes: "Graduate attributes",
  coMappingValid: "CO mapping is valid", bloomAppropriate: "Bloom classification is appropriate",
  learningEvidenceObservable: "Learning evidence is observable", intendedOutcomeMeasured: "Assessment measures intended outcome",
};
