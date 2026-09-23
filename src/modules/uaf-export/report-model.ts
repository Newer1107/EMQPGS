import definitions from "./framework-tables.json";
import { MISSING_DATA_PROTOCOL, SOURCE_PDF_HEADERS } from "./source-pdf-contract";

export const UNVERIFIABLE = "Unable to Verify";
export const INDEX_CODES = ["SCI", "MII", "BDI", "CVI", "MCAI", "DBI", "QCQI", "CAI", "AMI", "FRI"] as const;
export const PHASES = [
  "Executive Summary", "Question Bank Extraction", "Structural Compliance Index (SCI)",
  "Metadata Integrity Index (MII)", "Bloom Distribution Index (BDI)", "Coverage Validation Index (CVI)",
  "Marks Complexity Alignment Index (MCAI)", "Difficulty Balance Index (DBI)",
  "Question Construction Quality Index (QCQI)", "Constructive Alignment Index (CAI)",
  "Academic Moderation Index (AMI)", "Future Readiness Index (FRI)",
  "Overall Quality Index Computation", "Confidence Index", "Final Verdict",
] as const;
type RecordData = Record<string, unknown>;
export function record(value: unknown): RecordData {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordData : {};
}
function records(value: unknown): RecordData[] { return Array.isArray(value) ? value.map(record) : []; }
function numeric(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
export function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return UNVERIFIABLE;
  if (Array.isArray(value)) return value.length ? value.map(display).join(", ") : UNVERIFIABLE;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : UNVERIFIABLE;
  if (typeof value === "boolean") return value ? "Present" : "Absent";
  if (typeof value === "string") return value;
  return UNVERIFIABLE;
}
export function confidenceClass(value: unknown): string {
  const n = numeric(value);
  return n === null ? UNVERIFIABLE : n >= .9 ? "Very High" : n >= .8 ? "High" : n >= .65 ? "Medium" : n >= .5 ? "Low" : "Very Low";
}
function qualityClass(value: unknown): string {
  const n = numeric(value);
  return n === null ? UNVERIFIABLE : n >= .9 ? "Exemplary" : n >= .8 ? "Highly Effective" : n >= .7 ? "Effective" : n >= .6 ? "Acceptable" : n >= .5 ? "Needs Improvement" : "Major Revision Required";
}
export function unwrapEnvelope(value: unknown): unknown {
  const body = record(value);
  if (body.success === false) throw new Error(display(record(body.error).message));
  return body.success === true ? body.data : value;
}
export function isUafVersion(value: unknown): boolean {
  const version = record(value);
  const engine = record(version.questionBankAnalysis).evaluationEngineVersion ?? version.evaluationEngineVersion;
  return typeof engine === "string" && !engine.startsWith("eval-");
}

function extractionStatus(q: RecordData): string {
  if (typeof q.verificationStatus === "string") return q.verificationStatus;
  const statuses = Object.values(record(q.attributeStatuses));
  if (!statuses.length) return UNVERIFIABLE;
  if (statuses.length === 9 && statuses.every(s => s === "VERIFIED")) return "V";
  if (statuses.some(s => s === "VERIFIED" || s === "PARTIALLY_VERIFIED")) return "PV";
  return statuses.every(s => s === "MISSING_DATA") ? "M" : "UV";
}

/** Version snapshots are immutable. Never substitute the mutable analysis relation for a missing historical result. */
export function readVersion(value: unknown) {
  const version = record(unwrapEnvelope(value));
  const analysisSnapshot = record(version.analysisSnapshot);
  const full = record(analysisSnapshot.fullReport);
  const result = record(full.result);
  const evidence = record(version.evidenceSnapshot);
  const snapshot = Object.keys(record(full.snapshot)).length ? record(full.snapshot) : record(evidence.sourceDataSnapshot);
  const metrics = records(result.metrics);
  // Older snapshots still contain immutable metric values, but not classifications or confidence.
  if (!metrics.length) for (const [indexCode, value] of Object.entries(record(snapshot.metrics))) metrics.push({ indexCode, value });
  return { version, result, snapshot, evidence, metrics, analysisSnapshot, questions: records(snapshot.questions) };
}
export interface ReportTable { id: string; title: string; headers: string[]; rows: string[][] }
export interface ReportSection { number: number; title: string; narrative?: string; confidence: string; tables: ReportTable[] }
export interface UafReport { versionId: string; versionNumber: string; engineVersion: string; evidenceHash: string; sections: ReportSection[] }

function phaseFor(id: string): number {
  if (id === "2.7" || id === "11.6") return 14;
  if (/^[123]\./.test(id)) return 1;
  if (id.startsWith("4.")) return 2;
  if (id.startsWith("5.")) return 6;
  if (id.startsWith("6.")) return 4;
  if (id.startsWith("7.")) return 5;
  if (["8.6", "8.7", "8.11"].includes(id)) return 7;
  if (id.startsWith("8.")) return 8;
  if (id.startsWith("9.")) return 9;
  if (id.startsWith("10.6")) return 11;
  if (id.startsWith("10.7") || id === "10.8") return 12;
  if (id.startsWith("10.")) return 10;
  if (["11.1", "11.3", "11.4"].includes(id)) return 13;
  return 15;
}

export function buildUafReport(input: unknown): UafReport {
  const { version, result, snapshot, evidence, metrics, questions, analysisSnapshot } = readVersion(input);
  const metric = (code: string) => metrics.find(m => m.indexCode === code) ?? {};
  const val = (code: string) => numeric(metric(code).value);
  const conf = (code: string) => numeric(metric(code).confidenceScore) ?? numeric(record(metric(code).confidence).score) ?? numeric(record(snapshot.metricConfidence)[code]);
  const classification = (code: string) => code === "OCI" ? confidenceClass(val(code)) : qualityClass(val(code));
  const qid = (q: RecordData) => q.sourceQuestionId ?? q.questionId ?? q.qid ?? q.questionIndex;
  const qualityKeys = ["clarity", "precision", "technicalAccuracy", "context", "validity", "alignment", "fairness"];
  const reviewedScore = (value: unknown): number | null => {
    const reviewed = record(value);
    const score = numeric(reviewed.score);
    return score !== null && score >= 0 && score <= 1 && Array.isArray(reviewed.sourceIds) && reviewed.sourceIds.length > 0 ? score : null;
  };
  const qualityScores = (q: RecordData) => qualityKeys.map(key => reviewedScore(record(q.qualityEvidence)[key]));
  const sumMarks = (qs: RecordData[]) => qs.length && qs.every(q => numeric(q.marks) !== null) ? qs.reduce((s, q) => s + (numeric(q.marks) ?? 0), 0) : null;
  const totalMarks = numeric(snapshot.totalMarks) ?? sumMarks(questions);
  const totalQuestions = numeric(snapshot.totalQuestions) ?? numeric(evidence.totalQuestions) ?? (Array.isArray(snapshot.questions) ? questions.length : null);
  const phaseCodes = ["OCI", "ECS", ...INDEX_CODES, "QPQI", "OCI", "OCI"];
  const sections: ReportSection[] = PHASES.map((title, i) => {
    const code = phaseCodes[i];
    const score = code === "OCI" ? val(code) : conf(code);
    const confidence = score === null ? `${UNVERIFIABLE} — numerical confidence evidence is missing.`
      : `${score.toFixed(4)} (${(score * 100).toFixed(1)}%) · ${confidenceClass(score)} · ${display(record(metric(code).confidence).justification ?? "Source: version snapshot confidence score")}`;
    return { number: i + 1, title, confidence, tables: [] };
  });
  const modules = records(result.aiModules);
  const moduleSummary = modules.length
    ? modules.map(m => `${display(m.moduleId)}: ${m.success === true ? "Available" : "Unable to Verify (module failed or unavailable)"}`).join("; ")
    : "AI modules: Unable to Verify — no saved AI module results. Deterministic evidence remains available where recorded.";
  sections[0].narrative = `${display(result.executiveSummary)}\nAnalysis status: ${display(result.status)}\n${moduleSummary}`;
  sections[14].narrative = display(result.finalVerdict);
  const setRows = (table: ReportTable, rows: unknown[][]) => {
    table.rows = rows.length ? rows.map(row => table.headers.map((_, i) => display(row[i]))) : [table.headers.map(() => UNVERIFIABLE)];
  };
  const metricCodesByLabel: Record<string, string> = {
    "CO Coverage": "CVI", "LOTS Coverage": "LOTS", "HOTS Coverage": "HOTS", "Cognitive Balance Ratio": "CBR",
    "CO Accuracy": "COA", "PO Accuracy": "POA", "PI Accuracy": "PIA", "Bloom Accuracy": "RBTA", "Difficulty Accuracy": "DA",
    "Marks Accuracy": "MAA", "Question Type Accuracy": "QTA", "Metadata Completeness": "MC", "Metadata Consistency": "MCS",
  };
  for (const definition of [...definitions, MISSING_DATA_PROTOCOL]) {
    const table: ReportTable = { ...definition, headers: SOURCE_PDF_HEADERS[definition.id] ?? definition.headers, rows: definition.rows.map(row => row.map(display)) };
    const phase = phaseFor(table.id);
    const code = phaseCodes[phase - 1];
    if (table.headers.join() === "Metric,Value") {
      table.rows = definition.rows.map(row => {
        const label = row[0];
        const matchedCode = label.match(/\(([A-Z]+)\)/)?.[1] ?? (metrics.some(m => m.indexCode === label) ? label : metricCodesByLabel[label]);
        let value: unknown = matchedCode ? val(matchedCode) : null;
        if (matchedCode === "CBR") value = numeric(record(snapshot.rawMetrics).CBR) ?? value;
        if (table.id === "9.6") {
          const component = ["Clarity Score", "Precision Score", "Technical Accuracy Score", "Context Adequacy Score", "Assessment Validity Score", "Alignment Score", "Fairness Score"].indexOf(label);
          if (component >= 0) {
            const scores = questions.map(q => qualityScores(q)[component]);
            value = scores.length && scores.every(s => s !== null) ? scores.reduce<number>((sum, s) => sum + s!, 0) / scores.length : null;
          }
        }
        if (label === "Classification") value = classification(code);
        if (label === "Confidence") value = conf(code);
        if (label.endsWith(" Confidence")) value = conf(label.split(" ")[0]);
        if (label === "Confidence Classification") value = confidenceClass(val("OCI"));
        const summary: Record<string, unknown> = {
          "Total Questions": totalQuestions, "Total Marks": totalMarks,
          "Verified Questions": snapshot.verifiedQuestions ?? evidence.verifiedQuestions,
          "Partially Verified Questions": snapshot.partiallyVerifiedQuestions,
          "Unable to Verify Questions": snapshot.unableToVerifyQuestions ?? evidence.unableToVerifyQuestions,
          "Missing Data Questions": snapshot.missingDataQuestions ?? evidence.missingDataQuestions,
        };
        if (label in summary) value = summary[label];
        return [label, display(value)];
      });
    }
    switch (table.id) {
      case "4.2": table.rows = definition.rows.map(row => [row[0].split(".")[0], row[0].replace(/^\d+\.\s*/, "")]); break;
      case "4.3": setRows(table, questions.map(q => [qid(q), q.questionText, q.marks, q.coMapping, q.poMapping ?? q.poMappings, q.piMapping ?? q.piMappings, q.rbtLevel, q.difficultyLevel, extractionStatus(q)])); break;
      case "6.2": setRows(table, questions.map(q => [qid(q), q.coStatus, q.poStatus, q.piStatus, q.rbtStatus, q.difficultyStatus, q.verificationStatus, q.remarks])); break;
      case "6.3": case "6.4": case "6.5": case "6.6": case "6.7": case "6.8": case "6.9": {
        const [field, status] = ({ "6.3": ["coMapping", "coStatus"], "6.4": ["poMapping", "poStatus"], "6.5": ["piMapping", "piStatus"], "6.6": ["rbtLevel", "rbtStatus"], "6.7": ["difficultyLevel", "difficultyStatus"], "6.8": ["marks", "marksStatus"], "6.9": ["questionType", "questionTypeStatus"] } as Record<string, string[]>)[table.id];
        setRows(table, questions.map(q => {
          const correct = record(q.attributeAccuracy)[field];
          return [qid(q), q[field], correct === true ? q[field] : null, correct === true ? "Verified" : correct === false ? "Incorrect" : null, q.remarks ?? (q[status] ? `Extraction status: ${display(q[status])}; academic correctness requires reviewed evidence.` : null)];
        })); break;
      }
      case "7.6": setRows(table, questions.map(q => [qid(q), q.rbtLevel, record(q.attributeAccuracy).rbtLevel === true ? q.rbtLevel : null, record(q.attributeAccuracy).rbtLevel === true ? "Verified" : record(q.attributeAccuracy).rbtLevel === false ? "Incorrect" : null])); break;
      case "8.7": setRows(table, questions.map(q => [qid(q), q.marks, q.rbtLevel, q.marksAlignmentStatus, q.marksAlignmentComment])); break;
      case "9.3": setRows(table, questions.map(q => {
        const scores = qualityScores(q);
        const average = scores.every(s => s !== null) ? scores.reduce<number>((sum, s) => sum + s!, 0) / 7 : null;
        return [qid(q), ...scores, average];
      })); break;
      case "10.2": setRows(table, questions.map(q => [qid(q), q.coMapping, q.rbtLevel, q.learningActivity, q.alignmentEvidenceStatus])); break;
      case "3.14": case "11.1": case "11.3": {
        setRows(table, definition.rows.map(row => {
          const index = row[0], m = metric(index);
          if (table.id === "3.14") return [index, val(index), classification(index), conf(index)];
          if (table.id === "11.1") return [index, val(index), classification(index), row[3]];
          const weight = Number(row[2]);
          return [index, val(index), row[2], index === "QPQI" ? val(index) : numeric(m.weightedScore) ?? (val(index) === null ? null : val(index)! * weight)];
        })); break;
      }
      case "5.2": case "5.4": case "5.8": {
        const cos = [...new Set([...definition.rows.map(r => r[0]), ...questions.map(q => q.coMapping).filter((c): c is string => typeof c === "string")])];
        setRows(table, cos.map(co => {
          const matching = questions.filter(q => q.coMapping === co);
          const marks = matching.length ? sumMarks(matching) : null;
          // Absence from the extracted mappings does not prove a documented outcome is uncovered.
          if (table.id === "5.4") return [co, marks, marks !== null && totalMarks ? `${(marks / totalMarks * 100).toFixed(1)}%` : null];
          if (table.id === "5.8") return [co, matching.length || null, null, null];
          return [co, matching.length || null, marks, matching.length ? "Mapped in snapshot" : null, matching.length && totalQuestions ? `${(matching.length / totalQuestions * 100).toFixed(1)}%` : null];
        })); break;
      }
      case "7.2": case "8.2": {
        const field = table.id === "7.2" ? "rbtLevel" : "difficultyLevel";
        setRows(table, definition.rows.map(row => {
          const bloomLevels = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"];
          const matching = questions.filter(q => {
            const raw = String(q[field]);
            const normalized = field === "rbtLevel" && /^L[1-6]$/.test(raw) ? bloomLevels[Number(raw[1]) - 1] : raw;
            return normalized.toLowerCase() === row[0].toLowerCase();
          });
          return [row[0], questions.length ? matching.length : null, sumMarks(matching), questions.length ? `${(matching.length / questions.length * 100).toFixed(1)}%` : null];
        })); break;
      }
      case "11.7": case "11.8": {
        const key = table.id === "11.7" ? "strengths" : "weaknesses";
        const rows = records(result[key] ?? analysisSnapshot[key]);
        setRows(table, Array.from({ length: Math.max(5, rows.length) }, (_, i) => [rows[i]?.id ?? `${key === "strengths" ? "S" : "W"}${i + 1}`, rows[i]?.[key === "strengths" ? "strength" : "weakness"]])); break;
      }
      case "11.9": {
        const rows = records(result.recommendations ?? analysisSnapshot.recommendationsJson);
        setRows(table, Array.from({ length: Math.max(5, rows.length) }, (_, i) => [rows[i]?.id ?? `R${i + 1}`, rows[i]?.finding, rows[i]?.evidence, rows[i]?.recommendation, rows[i]?.priority])); break;
      }
      case "11.10": table.rows = definition.rows.map(row => [row[0], display(record(result.accreditationReadiness)[row[0]])]); break;
      case "10.6.2": case "10.7.2": {
        const evidence = records(record(snapshot.academicEvidence)[table.id === "10.6.2" ? "AMI" : "FRI"]);
        const normalized = (s: unknown) => String(s).toLowerCase().replace(/[^a-z]/g, "");
        setRows(table, definition.rows.map(row => {
          const reviewed = evidence.find(e => normalized(e.criterion) === normalized(row[0]));
          const score = reviewedScore(reviewed);
          return [row[0], score === null ? null : score === 1 ? "Satisfied" : "Not satisfied", score === null ? null : record(reviewed).sourceIds];
        })); break;
      }
    }
    sections[phase - 1].tables.push(table);
  }
  const structuralNames = ["Course Information", "Question Numbering", "Marks Allocation", "CO Mapping", "Bloom Mapping", "Difficulty Mapping", "Section Labels", "Assessment Instructions", "Metadata Consistency", "Question Formatting"];
  const structural = snapshot.structuralElements;
  const structuralKeys = ["courseInformation", "questionNumbering", "marksAllocation", "coMapping", "bloomMapping", "difficultyMapping", "sectionLabels", "assessmentInstructions", "metadataConsistency", "questionFormatting"];
  const structuralRows = structuralNames.map((name, i) => {
    const entry = Array.isArray(structural) ? records(structural).find(e => e.name === name || e.element === name || e.element === structuralKeys[i]) : record(structural)[structuralKeys[i]] ?? record(snapshot.structuralChecks)[structuralKeys[i]];
    const item = record(entry);
    return [name, display(typeof entry === "boolean" ? entry : item.present ?? item.status), display(item.evidence ?? item.sourceReference)];
  });
  sections[2].tables.push({ id: "3.3", title: "3.3 Structural Compliance Audit", headers: ["Structural Element", "Status", "Evidence"], rows: structuralRows }, {
    id: "SCI-report", title: "Structural Compliance Index Report", headers: ["Metric", "Value"], rows: [["SCI", display(val("SCI"))], ["Classification", classification("SCI")], ["Confidence", display(conf("SCI"))]],
  });
  return { versionId: display(version.id), versionNumber: display(version.versionNumber), engineVersion: display(version.evaluationEngineVersion), evidenceHash: display(version.evidenceHash), sections };
}
