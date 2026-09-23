import { z } from "zod";
import { AMI_CRITERIA, ATTRIBUTES, CAI_CRITERIA, FRI_CRITERIA, QCQI_CRITERIA, SOURCE_TYPES } from "./criteria";

export const evidenceSourceSchema = z.object({
  sourceType: z.enum(SOURCE_TYPES),
  reference: z.string().trim().min(3, "Cite a document, section, record ID or URL.").max(1000),
  rationale: z.string().trim().min(10, "Describe the reviewed evidence supporting this value (at least 10 characters).").max(4000),
}).strict();
const fingerprint = z.string().regex(/^[a-f0-9]{64}$/, "Invalid source version. Reload the review page.");
const unique = <T>(items: T[], key: (item: T) => string) => new Set(items.map(key)).size === items.length;
const attributeSchema = z.object({ attribute: z.enum(ATTRIBUTES), accurate: z.boolean(), evidence: evidenceSourceSchema }).strict();
const qcqiSchema = z.object({ criterion: z.enum(QCQI_CRITERIA), score: z.number().min(0).max(1), evidence: evidenceSourceSchema }).strict();
const caiSchema = z.object({ criterion: z.enum(CAI_CRITERIA), satisfied: z.boolean(), evidence: evidenceSourceSchema }).strict();
const binaryScore = z.union([z.literal(0), z.literal(1)]);
const amiSchema = z.object({ criterion: z.enum(AMI_CRITERIA), score: binaryScore, evidence: evidenceSourceSchema }).strict();
const friSchema = z.object({ criterion: z.enum(FRI_CRITERIA), score: binaryScore, evidence: evidenceSourceSchema }).strict();
export const questionReviewSchema = z.object({
  questionId: z.string().min(1).max(191), questionVersion: fingerprint,
  attributes: z.array(attributeSchema).max(ATTRIBUTES.length).refine(items => unique(items, item => item.attribute), "Duplicate attribute."),
  qcqi: z.array(qcqiSchema).max(7).refine(items => unique(items, item => item.criterion), "Duplicate QCQI criterion."),
  cai: z.array(caiSchema).max(4).refine(items => unique(items, item => item.criterion), "Duplicate CAI criterion."),
  metadataConsistency: z.object({ score: binaryScore, evidence: evidenceSourceSchema }).strict().optional(),
}).strict();
export const reviewEvidenceSchema = z.object({
  schemaVersion: z.literal(1), bankFingerprint: fingerprint,
  questions: z.array(questionReviewSchema).max(2000).refine(items => unique(items, item => item.questionId), "Duplicate question review."),
  bankCriteria: z.object({
    AMI: z.array(amiSchema).max(7).refine(items => unique(items, item => item.criterion), "Duplicate AMI criterion."),
    FRI: z.array(friSchema).max(7).refine(items => unique(items, item => item.criterion), "Duplicate FRI criterion."),
  }).strict(),
}).strict();
export const saveReviewSchema = z.object({ baseVersion: z.number().int().min(0), evidence: reviewEvidenceSchema }).strict();
export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type QuestionReview = z.infer<typeof questionReviewSchema>;
export type ReviewEvidence = z.infer<typeof reviewEvidenceSchema>;
export type SaveReview = z.infer<typeof saveReviewSchema>;
