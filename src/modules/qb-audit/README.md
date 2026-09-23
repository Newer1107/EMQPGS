# Question bank audit integration contract

Owned surfaces: this module, `src/components/qb-audit`, bank `/audit` API routes,
coordinator bank `/audit` page, Prisma schema and the audit migration.
No UAF or bank workflow code is changed.

- `QuestionLibraryItem.questionType`: nullable `QuestionType` (`THEORY`, `NUMERICAL`). Null means unknown; never infer theory from missing metadata.
- `QuestionLibraryItem.poMapping` / `piMapping`: nullable JSON arrays of nonempty mapping identifiers. Legacy null means unknown.
- `QuestionRevision.snapshotQuestionType`: nullable `QuestionType`; `snapshotPoMapping` / `snapshotPiMapping`: nullable JSON arrays. Main owns wiring revision capture.
- `QBAuditBlueprint`: append-only bank-specific versions of validated Table 1/2/3 JSON.
- `QBAuditSnapshot`: append-only DRAFT/FINAL versions with frozen criteria, source records, blueprint, evidence, score, remarks, and authenticated evaluator identity.
- Page: `/dashboard/coordinator/question-banks/{id}/audit`.
- GET/POST `/api/question-banks/{id}/audit`: load workspace / save new draft.
- POST `/api/question-banks/{id}/audit/finalize`: finalize an immutable draft once.
- GET/POST `/api/question-banks/{id}/audit/blueprint`: list / append blueprint.

All access requires an active coordinator assignment for the bank's subject department.
Auditing locked or archived banks is allowed: only append-only audit/blueprint records
are created. Bank content and workflow state remain unchanged.
Evaluator identity is always taken from the authenticated context. Missing evidence
produces No and an explicit reason. Academic judgments require evaluator evidence;
automated metadata checks do not imply academic correctness. Finalization certifies
the saved snapshot after a SHA-256 source check rejects changed questions, slots,
approval records or any newer blueprint. It does not change bank workflow.
Approval criteria I8/I10/J10 require stored ApprovalDecision records; free-text
evaluator assertions cannot substitute for an actual approval. Other qualitative
judgments are attributed signed-in evaluator reviews. Objective failures cannot
be overridden by manual responses.

The source is `QB-audit rubrics.pdf`, pages 2–11 (criteria), page 16 (thresholds),
pages 17–19 (blueprint). Criteria preserve text with PDF line-wrap hyphenation removed.
