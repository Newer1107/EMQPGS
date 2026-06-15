"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/client-fetch";

type AcademicYear = { id: string; code: string };
type Semester = { id: string; number: number; name: string; academicYearId: string };
type Subject = { id: string; subjectCode: string; subjectName: string; semesterId: string };
type SubjectVersion = { id: string; versionNumber: number; title: string; subjectId: string; effectiveFromAcademicYearId: string };
type QuestionBank = { id: string; subjectId: string; examCycleId: string; status: string };

type Coverage = {
  moduleCoverage: { moduleNumber: number; count: number; status: "adequate" | "partial" | "missing" }[];
  coCoverage: { co: string; count: number; status: "covered" | "missing" }[];
  rbtCoverage: { rbt: string; count: number; status: "covered" | "missing" }[];
  diffCoverage: { difficulty: string; count: number; status: "covered" | "missing" }[];
  approvedCount: number;
  totalCount: number;
};

const statusColors: Record<string, string> = {
  adequate: "bg-green-100 text-green-800 border-green-300",
  partial: "bg-yellow-100 text-yellow-800 border-yellow-300",
  missing: "bg-red-100 text-red-800 border-red-300",
  covered: "bg-green-100 text-green-800 border-green-300",
};

const moduleNames: Record<number, string> = {
  1: "Module 1", 2: "Module 2", 3: "Module 3", 4: "Module 4", 5: "Module 5", 6: "Module 6",
};

export function CoverageDashboardClient({
  academicYears,
  semesters,
  subjects,
  subjectVersions,
  questionBanks,
}: {
  academicYears: AcademicYear[];
  semesters: Semester[];
  subjects: Subject[];
  subjectVersions: SubjectVersion[];
  questionBanks: QuestionBank[];
}) {
  const [selectedAcademicYear, setSelectedAcademicYear] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedSubjectVersion, setSelectedSubjectVersion] = useState("");
  const [selectedQuestionBank, setSelectedQuestionBank] = useState("");
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredSemesters = selectedAcademicYear ? semesters.filter((s) => s.academicYearId === selectedAcademicYear) : [];
  const filteredSubjects = selectedSemester ? subjects.filter((s) => s.semesterId === selectedSemester) : subjects;
  const filteredVersions = selectedSubject ? subjectVersions.filter((v) => v.subjectId === selectedSubject) : subjectVersions;
  const filteredBanks = selectedSubject ? questionBanks.filter((b) => b.subjectId === selectedSubject) : questionBanks;

  async function fetchCoverage(subjectVersionId: string) {
    setLoading(true);
    setCoverage(null);
    try {
      const response = await apiFetch(`/api/question-library/coverage?subjectVersionId=${subjectVersionId}`);
      const result = await response.json();
      if (result.success) setCoverage(result.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  const gaps: string[] = [];
  if (coverage) {
    coverage.moduleCoverage.forEach((m) => {
      if (m.status === "missing") gaps.push(`${moduleNames[m.moduleNumber]} has no questions`);
      else if (m.status === "partial") gaps.push(`${moduleNames[m.moduleNumber]} has only ${m.count} question(s)`);
    });
    coverage.coCoverage.forEach((c) => {
      if (c.status === "missing") gaps.push(`${c.co} has no coverage`);
    });
    coverage.rbtCoverage.forEach((r) => {
      if (r.status === "missing") gaps.push(`No ${r.rbt} (${r.rbt}) questions`);
    });
    coverage.diffCoverage.forEach((d) => {
      if (d.status === "missing") gaps.push(`No ${d.difficulty} questions`);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Question Coverage Dashboard</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Analytics for approved questions across subject versions
          {coverage && <span> &middot; {coverage.approvedCount} approved / {coverage.totalCount} total</span>}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Academic Year</Label>
              <Select value={selectedAcademicYear} onChange={(e) => { setSelectedAcademicYear(e.target.value); setSelectedSemester(""); }}>
                <option value="">All Years</option>
                {academicYears.map((ay) => (
                  <option key={ay.id} value={ay.id}>{ay.code}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Semester</Label>
              <Select value={selectedSemester} onChange={(e) => { setSelectedSemester(e.target.value); setSelectedSubject(""); }}>
                <option value="">All Semesters</option>
                {filteredSemesters.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={selectedSubject} onChange={(e) => { setSelectedSubject(e.target.value); setSelectedSubjectVersion(""); }}>
                <option value="">All Subjects</option>
                {filteredSubjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.subjectCode} - {s.subjectName}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject Version</Label>
              <Select value={selectedSubjectVersion} onChange={(e) => { setSelectedSubjectVersion(e.target.value); if (e.target.value) fetchCoverage(e.target.value); else setCoverage(null); }}>
                <option value="">Select version...</option>
                {filteredVersions.map((v) => (
                  <option key={v.id} value={v.id}>v{v.versionNumber} - {v.title}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Question Bank</Label>
              <Select value={selectedQuestionBank} onChange={(e) => setSelectedQuestionBank(e.target.value)}>
                <option value="">All Banks</option>
                {filteredBanks.map((b) => (
                  <option key={b.id} value={b.id}>{b.status}</option>
                ))}
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && <p className="text-center text-[var(--muted-foreground)] py-8">Loading coverage data...</p>}

      {!loading && !coverage && selectedSubjectVersion && (
        <p className="text-center text-[var(--muted-foreground)] py-8">No coverage data available for this selection.</p>
      )}

      {!loading && !selectedSubjectVersion && (
        <p className="text-center text-[var(--muted-foreground)] py-8">Select a subject version to view coverage analytics.</p>
      )}

      {coverage && !loading && (
        <>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Module Coverage</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {coverage.moduleCoverage.map((m) => (
                    <div key={m.moduleNumber} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="font-medium">{moduleNames[m.moduleNumber]}</span>
                      <div className="flex items-center gap-2">
                        <span>{m.count} questions</span>
                        <Badge className={statusColors[m.status]}>{m.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>CO Coverage</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {coverage.coCoverage.map((c) => (
                    <div key={c.co} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="font-medium">{c.co}</span>
                      <div className="flex items-center gap-2">
                        <span>{c.count} questions</span>
                        <Badge className={statusColors[c.status]}>{c.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>RBT Coverage</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {coverage.rbtCoverage.map((r) => (
                    <div key={r.rbt} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="font-medium">{r.rbt}</span>
                      <div className="flex items-center gap-2">
                        <span>{r.count} questions</span>
                        <Badge className={statusColors[r.status]}>{r.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Difficulty Distribution</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {coverage.diffCoverage.map((d) => (
                    <div key={d.difficulty} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="font-medium">{d.difficulty}</span>
                      <div className="flex items-center gap-2">
                        <span>{d.count} questions</span>
                        <Badge className={statusColors[d.status]}>{d.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {gaps.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Coverage Gaps</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {gaps.map((gap, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                      <span className="text-red-600 font-medium">Warning:</span>
                      <span className="text-red-800">{gap}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {gaps.length === 0 && (
            <Card>
              <CardHeader><CardTitle>Coverage Gaps</CardTitle></CardHeader>
              <CardContent>
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  No coverage gaps detected. All modules, COs, RBT levels, and difficulties are adequately covered.
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
