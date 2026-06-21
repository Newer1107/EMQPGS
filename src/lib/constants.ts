import {
  CourseOutcome,
  DifficultyLevel,
  ExamCycleStatus,
  ExamType,
  QuestionBankPhase,
  QuestionStatus,
  RbtLevel,
  RecordStatus,
  ResponsibilityType,
  UserStatus,
} from "@prisma/client";

// ponytail: single source of truth for module ranges per exam type
export const EXAM_MODULE_RANGES: Record<ExamType, number[]> = {
  [ExamType.ISE_1]: [1, 2, 3],
  [ExamType.ISE_2]: [4, 5, 6],
  [ExamType.ENDSEM]: [1, 2, 3, 4, 5, 6],
  [ExamType.SUPPLEMENTARY]: [1, 2, 3, 4, 5, 6],
  [ExamType.KT]: [1, 2, 3, 4, 5, 6],
};

export const APP_NAME = "EMQPGS";
export const ACCESS_COOKIE = "emqpgs_access_token";
export const REFRESH_COOKIE = "emqpgs_refresh_token";
export const CSRF_COOKIE = "emqpgs_csrf_token";

export const responsibilityLabels: Record<ResponsibilityType, string> = {
  COE: "Controller of Examination",
  COORDINATOR: "Coordinator",
  MODERATOR: "Moderator",
  CONTRIBUTOR: "Contributor",
  DEAN: "Dean",
};

export const examTypeLabels: Record<ExamType, string> = {
  ISE_1: "ISE 1",
  ISE_2: "ISE 2",
  ENDSEM: "ENDSEM",
  SUPPLEMENTARY: "SUPPLEMENTARY",
  KT: "KT",
};

export const examCycleStatusLabels: Record<ExamCycleStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  CLOSED: "Closed",
};

export const questionBankPhaseLabels: Record<QuestionBankPhase, string> = {
  DRAFTING: "Drafting",
  MODERATION: "Moderation",
  APPROVAL: "Approval",
  COMPLETE: "Complete",
};

export const recordStatusLabels: Record<RecordStatus, string> = {
  ACTIVE: "Active",
  LOCKED: "Locked",
};

export const userStatusLabels: Record<UserStatus, string> = {
  ACTIVE: "Active",
  DISABLED: "Disabled",
};

export const courseOutcomeLabels: Record<CourseOutcome, string> = {
  CO1: "CO1",
  CO2: "CO2",
  CO3: "CO3",
  CO4: "CO4",
  CO5: "CO5",
  CO6: "CO6",
};

export const rbtLevelLabels: Record<RbtLevel, string> = {
  L1: "L1",
  L2: "L2",
  L3: "L3",
  L4: "L4",
  L5: "L5",
  L6: "L6",
};

export const difficultyLabels: Record<DifficultyLevel, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

export const questionStatusLabels: Record<QuestionStatus, string> = {
  DRAFT: "Draft",
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REVISION_REQUESTED: "Revision Requested",
  REVISION_SUBMITTED: "Revision Submitted",
};

export const ENTITY_TYPES = {
  QUESTION: "QUESTION",
  AI_REPORT: "AI_REPORT",
  GENERATED_PAPER: "GENERATED_PAPER",
  EXPORT_ARTIFACT: "EXPORT_ARTIFACT",
  SYSTEM_BACKUP: "SYSTEM_BACKUP",
  QUESTION_BANK: "QUESTION_BANK",
  USER: "USER",
  SUBJECT: "SUBJECT",
  EXAM_CYCLE: "EXAM_CYCLE",
  DEPARTMENT: "DEPARTMENT",
  DEAN_REVIEW: "DEAN_REVIEW",
  NOTIFICATION: "NOTIFICATION",
} as const;
