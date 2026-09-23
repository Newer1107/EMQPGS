import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { RawBankData, ReviewedScore } from "@/lib/uaf/types";
import { AMI_CRITERIA, CAI_CRITERIA, FRI_CRITERIA, QCQI_CRITERIA } from "./criteria";
import { attributeHasValue, loadReviewSource, type ReviewSource } from "./source";
import { reviewEvidenceSchema, type EvidenceSource } from "./validation";

type StoredReview = { id: string; version: number; reviewerId: string; evidence: unknown };
const normalize = (values: string[] | null | undefined) => [...(values ?? [])].sort().join("|");
function sourceMatchesRaw(raw: RawBankData, source: ReviewSource) {
  const filled = source.slots.filter(slot => slot.assignedQuestionId);
  return raw.questionBankId === source.bank.id && raw.subjectName === source.bank.subjectName && raw.subjectCode === source.bank.subjectCode &&
    raw.totalSlots === source.totalSlots && (raw.sourceBlueprint?.id ?? null) === source.blueprintId &&
    raw.questions.length === filled.length && new Set(raw.questions.map(q => q.sourceSlotId)).size === filled.length && raw.questions.every(q => {
    const slot = filled.find(slot => slot.id === q.sourceSlotId && slot.assignedQuestionId === q.sourceQuestionId);
    const current = source.questions.find(item => item.id === q.sourceQuestionId);
    return !!slot && !!current && q.sourceSlotNumber === slot.slotNumber && q.questionText === current.questionText && q.moduleNumber === slot.moduleNumber &&
      q.marks === current.marks && q.coMapping === current.coMapping && q.rbtLevel === current.rbtLevel &&
      q.difficultyLevel === current.difficultyLevel && q.questionType === current.questionType &&
      normalize(q.poMappings) === normalize(current.poMapping) && normalize(q.piMappings) === normalize(current.piMapping);
  });
}

/** Pure projection of immutable reviewed evidence; incomplete or stale evidence never becomes a score. */
export function applyReviewEvidence(raw: RawBankData, source: ReviewSource, review: StoredReview | null): RawBankData {
  if (!review) return raw;
  const parsed = reviewEvidenceSchema.safeParse(review.evidence);
  if (!parsed.success) return raw; // Unsupported stored versions fail closed; never fall back to an older review.
  const evidence = parsed.data;
  const consistent = sourceMatchesRaw(raw, source);
  const current = evidence.questions.filter(item => consistent && source.questions.some(q => q.id === item.questionId && q.questionVersion === item.questionVersion));
  const staleQuestionIds = evidence.questions.filter(item => !current.includes(item)).map(item => item.questionId).sort();
  const bankEvidenceCurrent = consistent && evidence.bankFingerprint === source.bankFingerprint;
  const refs = (path: string, evidence: EvidenceSource) => [`uaf-review:${review.id}:${path}`, `${evidence.sourceType}: ${evidence.reference}`, evidence.rationale];
  const questions = raw.questions.map(q => {
    const reviewed = current.find(item => item.questionId === q.sourceQuestionId);
    if (!reviewed) return q;
    const sourceQuestion = source.questions.find(item => item.id === q.sourceQuestionId)!;
    const next = { ...q, attributeStatuses: { ...q.attributeStatuses }, attributeAccuracy: { ...q.attributeAccuracy }, qualityEvidence: { ...q.qualityEvidence } };
    for (const value of reviewed.attributes) {
      if (!attributeHasValue(sourceQuestion, value.attribute)) continue;
      next.attributeStatuses[value.attribute] = "VERIFIED";
      next.attributeAccuracy[value.attribute] = value.accurate;
      if (value.attribute === "coMapping") next.coStatus = "VERIFIED";
      if (value.attribute === "rbtLevel") next.rbtStatus = "VERIFIED";
      if (value.attribute === "difficultyLevel") next.difficultyStatus = "VERIFIED";
      if (value.attribute === "poMapping") next.poStatus = "VERIFIED";
      if (value.attribute === "piMapping") next.piStatus = "VERIFIED";
      if (value.attribute === "questionType") next.questionTypeStatus = "VERIFIED";
    }
    for (const value of reviewed.qcqi) {
      next.qualityEvidence[value.criterion] = { criterion: value.criterion, score: value.score, sourceIds: refs(`question:${reviewed.questionId}:QCQI:${value.criterion}`, value.evidence) };
    }
    return next;
  });
  const academicEvidence = { ...raw.academicEvidence };
  const indexConfidence = { ...raw.indexConfidence };
  // These four indices belong exclusively to the latest saved review.
  for (const code of ["QCQI", "CAI", "AMI", "FRI", "MCS"] as const) delete academicEvidence[code];
  const reviews = questions.map(q => current.find(item => item.questionId === q.sourceQuestionId));
  indexConfidence.QCQI = { verified: reviews.reduce((n, item) => n + (item?.qcqi.length ?? 0), 0), required: questions.length * 7 };
  indexConfidence.CAI = { verified: reviews.reduce((n, item) => n + (item?.cai.length ?? 0), 0), required: questions.length * 4 };
  indexConfidence.MCS = { verified: reviews.filter(item => item?.metadataConsistency).length, required: questions.length };
  if (reviews.length && reviews.every(item => item?.metadataConsistency)) {
    academicEvidence.MCS = reviews.map(item => ({ criterion: item!.questionId, score: item!.metadataConsistency!.score,
      sourceIds: refs(`question:${item!.questionId}:MCS`, item!.metadataConsistency!.evidence) }));
  }
  if (reviews.length && reviews.every(item => item?.qcqi.length === QCQI_CRITERIA.length)) {
    academicEvidence.QCQI = QCQI_CRITERIA.map(criterion => {
      const scores = reviews.map(item => ({ questionId: item!.questionId, value: item!.qcqi.find(value => value.criterion === criterion)! }));
      return { criterion, score: scores.reduce((n, item) => n + item.value.score, 0) / scores.length,
        sourceIds: scores.flatMap(item => refs(`question:${item.questionId}:QCQI:${criterion}`, item.value.evidence)) };
    });
  }
  if (reviews.length && reviews.every(item => item?.cai.length === CAI_CRITERIA.length)) {
    academicEvidence.CAI = reviews.map(item => ({ criterion: item!.questionId, score: item!.cai.every(value => value.satisfied) ? 1 : 0,
      sourceIds: item!.cai.flatMap(value => refs(`question:${item!.questionId}:CAI:${value.criterion}`, value.evidence)) }));
  }
  for (const [code, criteria] of [["AMI", AMI_CRITERIA], ["FRI", FRI_CRITERIA]] as const) {
    const values = bankEvidenceCurrent ? evidence.bankCriteria[code] : [];
    indexConfidence[code] = { verified: values.length, required: criteria.length };
    if (values.length === criteria.length) academicEvidence[code] = values.map((value): ReviewedScore => ({ criterion: value.criterion, score: value.score, sourceIds: refs(`${code}:${value.criterion}`, value.evidence) }));
  }
  for (const [code, attribute] of [["COA", "coMapping"], ["POA", "poMapping"], ["PIA", "piMapping"], ["RBTA", "rbtLevel"], ["DA", "difficultyLevel"], ["MAA", "marks"], ["QTA", "questionType"]] as const) {
    indexConfidence[code] = { verified: questions.filter(q => typeof q.attributeAccuracy?.[attribute] === "boolean").length, required: questions.length };
  }
  return { ...raw, questions, academicEvidence, indexConfidence,
    reviewProvenance: { reviewId: review.id, version: review.version, reviewerId: review.reviewerId, staleQuestionIds, bankEvidenceCurrent },
  };
}

export async function applyLatestUafReview(raw: RawBankData): Promise<RawBankData> {
  return prisma.$transaction(async tx => {
    const review = await tx.uafReview.findFirst({ where: { questionBankId: raw.questionBankId }, orderBy: { version: "desc" } });
    if (!review) return raw;
    const source = await loadReviewSource(tx, raw.questionBankId);
    return applyReviewEvidence(raw, source, review);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}
