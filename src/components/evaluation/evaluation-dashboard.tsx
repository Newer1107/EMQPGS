"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/client-fetch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/ui/loading-skeleton";
import { BarChart, StackedBarChart, ScoreGauge, HeatmapGrid, ChartLegend } from "./charts";
import { VersionCompare } from "./version-compare";
import {
  Play, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2,
  BarChart3, Layers, Target, BookOpen, Brain, TrendingUp, GitCompare, FileDown,
} from "lucide-react";
import type { EvaluationReport, FinalVerdictLevel } from "@/lib/evaluation/types";

// ── Color Palette ────────────────────────────────────────────────

const RBT_COLORS = {
  remember: "#93c5fd",
  understand: "#60a5fa",
  apply: "#3b82f6",
  analyze: "#2563eb",
  evaluate: "#1d4ed8",
  create: "#1e3a8a",
};

const DIFFICULTY_COLORS = {
  easy: "#22c55e",
  medium: "#eab308",
  hard: "#ef4444",
};

const VERDICT_COLORS: Record<FinalVerdictLevel, string> = {
  "Highly Effective": "#22c55e",
  "Moderately Effective": "#eab308",
  "Needs Revision": "#ef4444",
};

// ── Main Dashboard ───────────────────────────────────────────────

export function EvaluationDashboard({ questionBankId }: { questionBankId: string }) {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [versions, setVersions] = useState<Array<{ id: string; version: number; createdAt: string }>>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>("objective");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["objective"]));
  const [showCompare, setShowCompare] = useState(false);

  // Fetch latest evaluation
  const fetchLatest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [evalRes, versionsRes] = await Promise.all([
        apiFetch(`/api/question-banks/${questionBankId}/evaluation`),
        apiFetch(`/api/question-banks/${questionBankId}/evaluation/versions`),
      ]);
      const evalBody = await evalRes.json();
      const versionsBody = await versionsRes.json();

      if (evalBody.success === false || evalBody.notFound) {
        setReport(null);
      } else if (evalBody.versions?.[0]?.analysisSnapshot?.fullReport) {
        setReport(evalBody.versions[0].analysisSnapshot.fullReport as EvaluationReport);
        setSelectedVersionId(evalBody.versions[0].id);
      } else {
        setReport(null);
      }

      if (Array.isArray(versionsBody)) {
        setVersions(versionsBody.flatMap((a: { versions: Array<{ id: string; versionNumber: number; createdAt: string }> }) =>
          a.versions.map((v) => ({ id: v.id, version: v.versionNumber, createdAt: v.createdAt }))
        ));
      }
    } catch {
      setError("Failed to load evaluation data.");
    }
    setLoading(false);
  }, [questionBankId]);

  useEffect(() => { fetchLatest(); }, [fetchLatest]);

  // Trigger evaluation
  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      // Send POST — this may take time if Ollama is slow
      const postRes = await apiFetch(`/api/question-banks/${questionBankId}/evaluation`, { method: "POST" });
      if (!postRes.ok) {
        const body = await postRes.json().catch(() => ({}));
        setError(body?.error ?? `Server error: ${postRes.status}`);
        setRunning(false);
        return;
      }
      // Poll GET until a report is available (server may still be processing AI)
      const pollStart = Date.now();
      const POLL_TIMEOUT = 120_000; // 2 minutes max
      const POLL_INTERVAL = 3_000;  // every 3 seconds
      let polled = false;
      while (Date.now() - pollStart < POLL_TIMEOUT) {
        const getRes = await apiFetch(`/api/question-banks/${questionBankId}/evaluation`);
        const getBody = await getRes.json();
        if (getBody.versions?.[0]?.analysisSnapshot?.fullReport) {
          setReport(getBody.versions[0].analysisSnapshot.fullReport as EvaluationReport);
          setSelectedVersionId(getBody.versions[0].id);
          polled = true;
          break;
        }
        if (getBody.status === "FAILED") {
          setError(`Evaluation failed: ${getBody.failureReason ?? "Unknown error"}`);
          setRunning(false);
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
      }
      if (!polled) {
        setError("Evaluation is still processing. The report will appear once complete — please refresh in a moment.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to trigger evaluation.");
    }
    setRunning(false);
  };

  // Load specific version
  const loadVersion = async (versionId: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/question-banks/${questionBankId}/evaluation/versions/${versionId}`);
      const body = await res.json();
      if (body?.analysisSnapshot?.fullReport) {
        setReport(body.analysisSnapshot.fullReport as EvaluationReport);
        setSelectedVersionId(versionId);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setActiveSection(id);
  };

  // ── Loading State ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton variant="card" className="h-48 w-full" />
        <LoadingSkeleton variant="card" className="h-64 w-full" />
        <LoadingSkeleton variant="card" className="h-64 w-full" />
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────
  if (error) {
    return (
      <Card className="border-red-500/30 bg-red-50/50">
        <CardContent className="py-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-2" />
          <p className="text-red-800 font-medium">{error}</p>
          <Button className="mt-4" variant="outline" onClick={fetchLatest}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  // ── Empty State (no evaluation yet) ──────────────────────────
  if (!report) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <BarChart3 className="mb-4 h-12 w-12 text-[var(--text-tertiary)]" />
          <p className="text-lg font-medium">No evaluation yet</p>
          <p className="mt-1 text-sm text-[var(--text-tertiary)] mb-4">
            Generate an academic quality evaluation for this question bank.
          </p>
          <Button onClick={handleRun} disabled={running}>
            {running ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Running…</> : <><Play className="mr-2 h-4 w-4" /> Generate Evaluation</>}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Sections Navigation ──────────────────────────────────────
  const sections = [
    { id: "objective", label: "Objective", icon: BookOpen },
    { id: "module-summary", label: "Module Summary", icon: Layers },
    { id: "attribute-completeness", label: "Attribute Completeness", icon: CheckCircle2 },
    { id: "rbt-distribution", label: "RBT Distribution", icon: Brain },
    { id: "difficulty-distribution", label: "Difficulty Distribution", icon: BarChart3 },
    { id: "marks-distribution", label: "Marks Distribution", icon: TrendingUp },
    { id: "coverage", label: "CO Coverage", icon: Target },
    { id: "alignment", label: "Constructive Alignment", icon: Layers },
    { id: "quality", label: "Quality Metrics", icon: BarChart3 },
    { id: "final-assessment", label: "Final Assessment", icon: Layers },
    { id: "scores", label: "Consolidated Scores", icon: TrendingUp },
    { id: "verdict", label: "Final Verdict", icon: Target },
    { id: "findings", label: "Question Findings", icon: AlertTriangle },
  ];

  // ── Verdict Check ────────────────────────────────────────────
  const needsRevision = report.verdict.verdict === "Needs Revision";

  return (
    <div className="space-y-6">
      {/* Header with version selector */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Question Bank Evaluation</h1>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">
            {report.objective.subjectName} ({report.objective.subjectCode}) · Sem {report.objective.semesterNumber} · {report.objective.academicYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {versions.length > 1 && (
            <select
              className="h-9 rounded-lg border border-[var(--border)] bg-white px-3 text-xs font-medium"
              value={selectedVersionId ?? ""}
              onChange={(e) => loadVersion(e.target.value)}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  Version {v.version} · {new Date(v.createdAt).toLocaleDateString()}
                </option>
              ))}
            </select>
          )}
          {versions.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => setShowCompare(!showCompare)}>
              <GitCompare className="mr-1 h-4 w-4" /> {showCompare ? "Close" : "Compare"}
            </Button>
          )}
          <Button variant="outline" size="sm" disabled title="Export coming soon">
            <FileDown className="mr-1 h-4 w-4" /> Export
          </Button>
          <Button onClick={handleRun} disabled={running} size="sm">
            {running ? <><RefreshCw className="mr-1 h-4 w-4 animate-spin" /> Running…</> : <><Play className="mr-1 h-4 w-4" /> {report ? "Re-run" : "Run"}</>}
          </Button>
        </div>
      </div>

      {showCompare && versions.length > 1 && (
        <VersionCompare questionBankId={questionBankId} versions={versions} onClose={() => setShowCompare(false)} />
      )}

      {/* Verdict banner */}
      <div
        className={`rounded-xl border p-4 ${needsRevision ? "border-red-200 bg-red-50" : report.verdict.verdict === "Highly Effective" ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}
      >
        <div className="flex items-center gap-3">
          <ScoreGauge score={report.verdict.overallScore} size={80} />
          <div>
            <p className="text-lg font-bold" style={{ color: VERDICT_COLORS[report.verdict.verdict] }}>
              {report.verdict.verdict}
            </p>
            <p className="text-sm text-[var(--text-tertiary)]">
              Overall Score: {(report.verdict.overallScore * 100).toFixed(0)}% · Engine: {report.engineVersion} · Prompt: {report.promptVersion}
            </p>
          </div>
        </div>
      </div>

      {/* Section navigation */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => toggleSection(s.id)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              expandedSections.has(s.id) ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Sections Content ───────────────────────────────────*/}

      <div className="space-y-6">
        {/* 1. Objective */}
        <SectionCard id="objective" title="1. Objective" icon={BookOpen} isExpanded={expandedSections.has("objective")} onToggle={() => toggleSection("objective")}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatBox label="Subject" value={report.objective.subjectName} />
            <StatBox label="Code" value={report.objective.subjectCode} />
            <StatBox label="Batch" value={report.objective.batchName} />
            <StatBox label="Semester" value={`Sem ${report.objective.semesterNumber}`} />
            <StatBox label="Academic Year" value={report.objective.academicYear} />
            <StatBox label="Department" value={report.objective.departmentName} />
            <StatBox label="Total Questions" value={String(report.objective.totalQuestions)} />
            <StatBox label="Evaluation Date" value={new Date(report.objective.evaluationDate).toLocaleDateString()} />
          </div>
          {report.objective.narrative && (
            <AiNarrative text={report.objective.narrative} />
          )}
        </SectionCard>

        {/* 2. Module Summary */}
        <SectionCard id="module-summary" title="2. Module Summary" icon={Layers} isExpanded={expandedSections.has("module-summary")} onToggle={() => toggleSection("module-summary")}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
                  <th className="text-left py-2 pr-2">Module</th>
                  <th className="text-left py-2 pr-2">Slots</th>
                  <th className="text-left py-2 pr-2">Filled</th>
                  <th className="text-left py-2 pr-2">Marks</th>
                  <th className="text-left py-2 pr-2">Category</th>
                  <th className="text-left py-2 pr-2">COs</th>
                </tr>
              </thead>
              <tbody>
                {report.moduleSummary.map((m) => (
                  <tr key={m.moduleNumber} className="border-b border-[var(--border)]/50">
                    <td className="py-2 pr-2 font-medium">{m.moduleName}</td>
                    <td className="py-2 pr-2">{m.totalSlots}</td>
                    <td className="py-2 pr-2">{m.filledSlots}</td>
                    <td className="py-2 pr-2">{m.totalMarks}</td>
                    <td className="py-2 pr-2">                        <Badge>{m.category}</Badge></td>
                    <td className="py-2 pr-2 text-xs text-[var(--text-tertiary)]">{m.articulation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.moduleSummaryAiNarrative && (
            <AiNarrative text={report.moduleSummaryAiNarrative} />
          )}
        </SectionCard>

        {/* 3. Attribute Completeness */}
        <SectionCard id="attribute-completeness" title="3. Attribute Completeness" icon={CheckCircle2} isExpanded={expandedSections.has("attribute-completeness")} onToggle={() => toggleSection("attribute-completeness")}>
          <div className="mb-4 flex items-center gap-3">
            <ScoreGauge score={report.overallCompletenessPct / 100} size={80} />
            <div>
              <p className="font-semibold">{report.overallCompletenessPct}% Complete</p>
              <p className="text-xs text-[var(--text-tertiary)]">Across all modules</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
                  <th className="text-left py-2 pr-2">Module</th>
                  <th className="text-left py-2 pr-2">Total</th>
                  <th className="text-left py-2 pr-2">Complete</th>
                  <th className="text-left py-2 pr-2">Missing RBT</th>
                  <th className="text-left py-2 pr-2">Missing CO</th>
                  <th className="text-left py-2 pr-2">Missing Diff</th>
                  <th className="text-left py-2 pr-2">%</th>
                </tr>
              </thead>
              <tbody>
                {report.attributeCompleteness.map((a) => (
                  <tr key={a.moduleNumber} className="border-b border-[var(--border)]/50">
                    <td className="py-2 pr-2 font-medium">Module {a.moduleNumber}</td>
                    <td className="py-2 pr-2">{a.totalQuestions}</td>
                    <td className="py-2 pr-2">{a.metadataComplete}</td>
                    <td className="py-2 pr-2">{a.missingRbt > 0 ? <span className="text-red-600">{a.missingRbt}</span> : "0"}</td>
                    <td className="py-2 pr-2">{a.missingCo > 0 ? <span className="text-red-600">{a.missingCo}</span> : "0"}</td>
                    <td className="py-2 pr-2">{a.missingDifficulty > 0 ? <span className="text-red-600">{a.missingDifficulty}</span> : "0"}</td>
                    <td className="py-2 pr-2">
                      <span className={`font-medium ${a.completenessPct >= 80 ? "text-green-600" : a.completenessPct >= 50 ? "text-amber-600" : "text-red-600"}`}>
                        {a.completenessPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.attributeAiNarrative && <AiNarrative text={report.attributeAiNarrative} />}
        </SectionCard>

        {/* 4. RBT Distribution */}
        <SectionCard id="rbt-distribution" title="4. RBT Distribution (Bloom's Taxonomy)" icon={Brain} isExpanded={expandedSections.has("rbt-distribution")} onToggle={() => toggleSection("rbt-distribution")}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium mb-2">Overall Distribution</p>
              <BarChart
                data={[
                  { label: "Remember", value: report.overallRbt.remember, color: RBT_COLORS.remember },
                  { label: "Understand", value: report.overallRbt.understand, color: RBT_COLORS.understand },
                  { label: "Apply", value: report.overallRbt.apply, color: RBT_COLORS.apply },
                  { label: "Analyze", value: report.overallRbt.analyze, color: RBT_COLORS.analyze },
                  { label: "Evaluate", value: report.overallRbt.evaluate, color: RBT_COLORS.evaluate },
                  { label: "Create", value: report.overallRbt.create, color: RBT_COLORS.create },
                ]}
                height={180}
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Per Module Breakdown</p>
              {report.moduleRbt.map((m) => (
                <div key={m.moduleNumber} className="mb-3">
                  <p className="text-xs font-medium text-[var(--text-secondary)] mb-1">Module {m.moduleNumber} ({m.total} questions)</p>
                  <StackedBarChart
                    segments={[
                      { label: "Remember", value: m.distribution.remember, color: RBT_COLORS.remember },
                      { label: "Understand", value: m.distribution.understand, color: RBT_COLORS.understand },
                      { label: "Apply", value: m.distribution.apply, color: RBT_COLORS.apply },
                      { label: "Analyze", value: m.distribution.analyze, color: RBT_COLORS.analyze },
                      { label: "Evaluate", value: m.distribution.evaluate, color: RBT_COLORS.evaluate },
                      { label: "Create", value: m.distribution.create, color: RBT_COLORS.create },
                    ]}
                    height={20}
                  />
                </div>
              ))}
            </div>
          </div>
          <ChartLegend
            items={[
              { label: "Remember (L1)", color: RBT_COLORS.remember },
              { label: "Understand (L2)", color: RBT_COLORS.understand },
              { label: "Apply (L3)", color: RBT_COLORS.apply },
              { label: "Analyze (L4)", color: RBT_COLORS.analyze },
              { label: "Evaluate (L5)", color: RBT_COLORS.evaluate },
              { label: "Create (L6)", color: RBT_COLORS.create },
            ]}
          />
          {report.rbtAiNarrative && <AiNarrative text={report.rbtAiNarrative} />}
        </SectionCard>

        {/* 5. Difficulty Distribution */}
        <SectionCard id="difficulty-distribution" title="5. Difficulty Distribution" icon={BarChart3} isExpanded={expandedSections.has("difficulty-distribution")} onToggle={() => toggleSection("difficulty-distribution")}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium mb-2">Overall</p>
              <BarChart
                data={[
                  { label: "Easy", value: report.overallDifficulty.easy, color: DIFFICULTY_COLORS.easy },
                  { label: "Medium", value: report.overallDifficulty.medium, color: DIFFICULTY_COLORS.medium },
                  { label: "Hard", value: report.overallDifficulty.hard, color: DIFFICULTY_COLORS.hard },
                ]}
                height={100}
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Per Module</p>
              {report.moduleDifficulty.map((m) => (
                <div key={m.moduleNumber} className="mb-2">
                  <p className="text-xs text-[var(--text-secondary)] mb-0.5">Module {m.moduleNumber} ({m.total} q)</p>
                  <StackedBarChart
                    segments={[
                      { label: "Easy", value: m.distribution.easy, color: DIFFICULTY_COLORS.easy },
                      { label: "Medium", value: m.distribution.medium, color: DIFFICULTY_COLORS.medium },
                      { label: "Hard", value: m.distribution.hard, color: DIFFICULTY_COLORS.hard },
                    ]}
                    height={16}
                  />
                </div>
              ))}
            </div>
          </div>
          {report.difficultyAiNarrative && <AiNarrative text={report.difficultyAiNarrative} />}
        </SectionCard>

        {/* 6. Marks Distribution */}
        <SectionCard id="marks-distribution" title="6. Marks Distribution" icon={TrendingUp} isExpanded={expandedSections.has("marks-distribution")} onToggle={() => toggleSection("marks-distribution")}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium mb-2">Overall</p>
              <BarChart
                data={Object.entries(report.overallMarks).map(([marks, count]) => ({
                  label: `${marks} marks`,
                  value: count,
                }))}
                height={Object.keys(report.overallMarks).length * 36}
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Per Module</p>
              {report.moduleMarks.map((m) => (
                <div key={m.moduleNumber} className="mb-3 p-2 rounded-lg bg-[var(--surface-hover)]">
                  <p className="text-xs font-medium mb-1">Module {m.moduleNumber}</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(m.distribution).map(([marks, count]) => (
                      <span key={marks} className="inline-flex items-center rounded bg-white px-2 py-0.5 text-xs border">
                        {marks}m: {count}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {report.marksAiNarrative && <AiNarrative text={report.marksAiNarrative} />}
        </SectionCard>

        {/* 7. CO Coverage */}
        <SectionCard id="coverage" title="7. CO–PO–PI Coverage" icon={Target} isExpanded={expandedSections.has("coverage")} onToggle={() => toggleSection("coverage")}>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
                  <th className="text-left py-2 pr-2">CO</th>
                  <th className="text-left py-2 pr-2">Questions</th>
                  <th className="text-left py-2 pr-2">Modules</th>
                  <th className="text-left py-2 pr-2">Coverage</th>
                  <th className="text-left py-2 pr-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {report.coCoverage.map((c) => (
                  <tr key={c.co} className="border-b border-[var(--border)]/50">
                    <td className="py-2 pr-2 font-medium">{c.co}</td>
                    <td className="py-2 pr-2">{c.totalQuestions}</td>
                    <td className="py-2 pr-2 text-xs text-[var(--text-tertiary)]">{c.modules.join(", ")}</td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-[var(--surface-hover)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${c.coveragePct >= 50 ? "bg-green-500" : "bg-red-500"}`}
                            style={{ width: `${c.coveragePct}%` }}
                          />
                        </div>
                        <span className="text-xs">{c.coveragePct}%</span>
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      {c.coveragePct >= 50
                        ? <Badge variant="success" className="text-[10px]">Covered</Badge>
                        : <Badge variant="danger" className="text-[10px]">Weak</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CO × Module Heatmap */}
          <p className="text-sm font-medium mb-2">CO × Module Heatmap</p>
          <HeatmapGrid
            data={report.coCoverage.flatMap((c) =>
              report.moduleSummary.map((m) => ({
                row: c.co,
                col: `M${m.moduleNumber}`,
                value: c.modules.includes(m.moduleNumber) ? c.totalQuestions : 0,
              }))
            )}
          />
          {report.coCoverageAiNarrative && <AiNarrative text={report.coCoverageAiNarrative} />}
        </SectionCard>

        {/* 8. Constructive Alignment */}
        <SectionCard id="alignment" title="8. Constructive Alignment" icon={Layers} isExpanded={expandedSections.has("alignment")} onToggle={() => toggleSection("alignment")}>
          <div className="flex items-center gap-4 mb-4">
            <ScoreGauge score={report.alignmentSummary.score} size={80} />
            <div>
              <p className="font-semibold">Alignment Score: {(report.alignmentSummary.score * 100).toFixed(0)}%</p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Measures Outcome → Teaching → Assessment alignment
              </p>
            </div>
          </div>
          {report.alignmentSummary.risks.length > 0 && (
            <div className="mb-3 space-y-1">
              <p className="text-sm font-medium text-red-700">Risks</p>
              {report.alignmentSummary.risks.map((r, i) => (
                <p key={i} className="text-sm text-red-600 flex items-start gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {r}
                </p>
              ))}
            </div>
          )}
          {report.alignmentAiNarrative && <AiNarrative text={report.alignmentAiNarrative} />}
        </SectionCard>

        {/* 9. Quality Metrics */}
        <SectionCard id="quality" title="9. Quality Metrics" icon={BarChart3} isExpanded={expandedSections.has("quality")} onToggle={() => toggleSection("quality")}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
                  <th className="text-left py-2 pr-2">Module</th>
                  <th className="text-left py-2 pr-2">Clarity</th>
                  <th className="text-left py-2 pr-2">Relevance</th>
                  <th className="text-left py-2 pr-2">RBT Accuracy</th>
                  <th className="text-left py-2 pr-2">PO/PI</th>
                  <th className="text-left py-2 pr-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {report.qualityMetrics.map((m) => (
                  <tr key={m.moduleNumber} className="border-b border-[var(--border)]/50">
                    <td className="py-2 pr-2 font-medium">Module {m.moduleNumber}</td>
                    <td className="py-2 pr-2"><ScoreBadge score={m.clarity} /></td>
                    <td className="py-2 pr-2"><ScoreBadge score={m.relevance} /></td>
                    <td className="py-2 pr-2"><ScoreBadge score={m.rbtAccuracy} /></td>
                    <td className="py-2 pr-2"><ScoreBadge score={m.poPiCoverage} /></td>
                    <td className="py-2 pr-2 text-xs text-[var(--text-tertiary)]">{m.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {report.qualityAiNarrative && <AiNarrative text={report.qualityAiNarrative} />}
        </SectionCard>

        {/* 10. Final Assessment */}
        <SectionCard id="final-assessment" title="10. Final Assessment" icon={Layers} isExpanded={expandedSections.has("final-assessment")} onToggle={() => toggleSection("final-assessment")}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {report.finalAssessments.map((a) => (
              <div key={a.moduleNumber} className={`rounded-lg border p-4 ${a.rating === "Highly Effective" ? "border-green-200 bg-green-50/50" : a.rating === "Effective" ? "border-blue-200 bg-blue-50/50" : a.rating === "Acceptable" ? "border-amber-200 bg-amber-50/50" : "border-red-200 bg-red-50/50"}`}>
                <p className="text-sm font-semibold mb-1">Module {a.moduleNumber}</p>
                <Badge variant={a.rating === "Highly Effective" || a.rating === "Effective" ? "success" : a.rating === "Acceptable" ? "warning" : "danger"}>
                  {a.rating}
                </Badge>
                <p className="text-xs text-[var(--text-tertiary)] mt-2">Score: {(a.threshold * 100).toFixed(0)}%</p>
                {a.strengths.length > 0 && (
                  <div className="mt-2">
                    {a.strengths.map((s, i) => (
                      <p key={i} className="text-xs text-green-700 flex items-start gap-1">
                        <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" /> {s}
                      </p>
                    ))}
                  </div>
                )}
                {a.weaknesses.length > 0 && (
                  <div className="mt-1">
                    {a.weaknesses.map((w, i) => (
                      <p key={i} className="text-xs text-red-600 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {report.finalAssessmentAiNarrative && <AiNarrative text={report.finalAssessmentAiNarrative} />}
        </SectionCard>

        {/* 11. Consolidated Scores */}
        <SectionCard id="scores" title="11. Consolidated Scores" icon={TrendingUp} isExpanded={expandedSections.has("scores")} onToggle={() => toggleSection("scores")}>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-[var(--text-tertiary)] uppercase tracking-wider">
                  <th className="text-left py-2 pr-2">Module</th>
                  <th className="text-left py-2 pr-2">Clarity</th>
                  <th className="text-left py-2 pr-2">Relevance</th>
                  <th className="text-left py-2 pr-2">RBT Acc.</th>
                  <th className="text-left py-2 pr-2">Completeness</th>
                  <th className="text-left py-2 pr-2">Average</th>
                  <th className="text-left py-2 pr-2">Overall</th>
                </tr>
              </thead>
              <tbody>
                {report.consolidatedScores.map((s) => (
                  <tr key={s.moduleNumber} className="border-b border-[var(--border)]/50">
                    <td className="py-2 pr-2 font-medium">Module {s.moduleNumber}</td>
                    <td className="py-2 pr-2"><ScoreBadge score={s.clarity} /></td>
                    <td className="py-2 pr-2"><ScoreBadge score={s.relevance} /></td>
                    <td className="py-2 pr-2"><ScoreBadge score={s.rbtAccuracy} /></td>
                    <td className="py-2 pr-2"><ScoreBadge score={s.completeness} /></td>
                    <td className="py-2 pr-2"><ScoreBadge score={s.average} /></td>
                    <td className="py-2 pr-2"><ScoreBadge score={s.overallScore} bold /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-hover)]">
            <ScoreGauge score={report.overallAverage} size={64} />
            <div>
              <p className="font-semibold">Overall Average: {(report.overallAverage * 100).toFixed(0)}%</p>
              <p className="text-xs text-[var(--text-tertiary)]">Mean of all module scores</p>
            </div>
          </div>
          {report.qualityAiNarrative && <AiNarrative text={report.qualityAiNarrative} />}
        </SectionCard>

        {/* 12. Final Verdict */}
        <SectionCard id="verdict" title="12. Final Verdict" icon={Target} isExpanded={expandedSections.has("verdict")} onToggle={() => toggleSection("verdict")}>
          <div className="flex items-center gap-6 p-6 rounded-xl border" style={{ borderColor: VERDICT_COLORS[report.verdict.verdict] }}>
            <ScoreGauge score={report.verdict.overallScore} size={120} />
            <div>
              <p className="text-2xl font-bold" style={{ color: VERDICT_COLORS[report.verdict.verdict] }}>
                {report.verdict.verdict}
              </p>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                Score: {(report.verdict.overallScore * 100).toFixed(0)}% · Thresholds: ≥{(report.verdict.thresholds.highlyEffective * 100).toFixed(0)}% Highly Effective · ≥{(report.verdict.thresholds.moderatelyEffective * 100).toFixed(0)}% Moderately Effective
              </p>
            </div>
          </div>
          {report.verdictAiNarrative && <AiNarrative text={report.verdictAiNarrative} />}
        </SectionCard>

        {/* 13. Question-Level Findings */}
        <SectionCard id="findings" title="Question-Level Findings" icon={AlertTriangle} isExpanded={expandedSections.has("findings")} onToggle={() => toggleSection("findings")}>
          {report.questionFindings.length === 0 ? (
            <div className="py-8 text-center text-sm text-[var(--text-tertiary)]">
              <CheckCircle2 className="mx-auto h-8 w-8 text-green-500 mb-2" />
              <p>No question-level issues detected. All questions appear well-formed.</p>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium mb-3 text-amber-700">
                {report.questionFindings.length} question{report.questionFindings.length !== 1 ? "s" : ""} flagged for review
              </p>
              <div className="space-y-3">
                {report.questionFindings.map((f) => (
                  <div key={f.slotId} className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Badge>M{f.moduleNumber}</Badge>
                        <span className="text-sm font-medium">{f.slotId.slice(0, 8)}</span>
                        <span className="text-xs text-[var(--text-tertiary)]">{f.marks} marks</span>
                      </div>
                      <span className="text-xs text-[var(--text-tertiary)]">Confidence: {f.confidence}%</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-[var(--text-tertiary)]">Current:</span> RBT={f.currentRbt ?? "—"} · Diff={f.difficulty ?? "—"} · CO={f.co ?? "—"}
                      </div>
                      <div>
                        <span className="text-red-600 font-medium">Problem:</span> {f.problem}
                      </div>
                      <div>
                        <span className="text-amber-600 font-medium">Pedagogical Impact:</span> {f.pedagogicalConsequence}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-green-700">
                      <span className="font-medium">Recommendation:</span> {f.recommendation}
                    </p>
                  </div>
                ))}
              </div>
              {report.findingsAiNarrative && <AiNarrative text={report.findingsAiNarrative} />}
            </>
          )}
        </SectionCard>

        {/* Strengths & Weaknesses Summary */}
        {report.verdictAiNarrative && report.questionFindings.length > 0 && (
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Improvement Roadmap</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--text-tertiary)]">
                Address the {report.questionFindings.length} flagged question{report.questionFindings.length !== 1 ? "s" : ""}, complete metadata for modules below 80% completeness, and review RBT distribution for balance.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Section Card Component ──────────────────────────────────────

function SectionCard({ id, title, icon: Icon, isExpanded, onToggle, children }: {
  id: string; title: string; icon: React.ComponentType<{ className?: string }>;
  isExpanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <Card id={id}>
      <button onClick={onToggle} className="flex w-full items-center justify-between p-4 text-left hover:bg-[var(--surface-hover)] transition-colors rounded-t-lg">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[var(--text-tertiary)]" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {isExpanded ? <ChevronDown className="h-4 w-4 text-[var(--text-tertiary)]" /> : <ChevronRight className="h-4 w-4 text-[var(--text-tertiary)]" />}
      </button>
      {isExpanded && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold truncate">{value}</p>
    </div>
  );
}

function ScoreBadge({ score, bold }: { score: number; bold?: boolean }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-600";
  return <span className={`${color} ${bold ? "font-bold" : "font-medium"} text-xs`}>{pct}%</span>;
}

function AiNarrative({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="mt-4 rounded-lg bg-[var(--surface-hover)] p-4 text-sm leading-relaxed whitespace-pre-wrap border-l-4 border-[var(--accent)]">
      <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-2">AI Commentary</p>
      {text}
    </div>
  );
}
