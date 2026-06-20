"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { feedback } from "@/lib/feedback";
import { apiFetch } from "@/lib/client-fetch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WizardProgress } from "@/components/exam-cycles/wizard-progress";
import { EntityStatusBanner } from "@/components/shared/entity-status-banner";
import { examTypeLabels } from "@/lib/constants";
import { getSubjectsForBatchSemester } from "@/modules/exam-cycles/actions";

type Batch = { id: string; name: string; code: string; admissionYear: number; department: { id: string; name: string; code: string } | null; curriculumScheme: { id: string; name: string; year: number } | null };
type BatchSemester = { id: string; semesterNumber: number; status: string; department: { id: string; name: string } | null; academicYear: { code: string } | null };
type Subject = { subjectId: string; subjectCode: string; subjectName: string; credits: number; groupAssignment: string; departmentName: string };

const EXAM_TYPES = ["ISE_1", "ISE_2", "ENDSEM", "SUPPLEMENTARY", "KT"] as const;

export function CreateExamCycleWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [batches, setBatches] = useState<Batch[]>([]);
  const [semesters, setSemesters] = useState<BatchSemester[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [loadingSemesters, setLoadingSemesters] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [selectedExamType, setSelectedExamType] = useState("");
  const [removedSubjectIds, setRemovedSubjectIds] = useState<Set<string>>(new Set());

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);
  const selectedSemester = semesters.find((s) => s.id === selectedSemesterId);
  const visibleSubjects = subjects.filter((s) => !removedSubjectIds.has(s.subjectId));

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/batches");
        const json = await res.json();
        setBatches(json.data ?? json);
      } catch (error) {
        console.error("[CreateWizard]", error);
        feedback.error("Could not load batches");
      } finally {
        setLoadingBatches(false);
      }
    }
    load();
  }, []);

  const loadSemesters = useCallback(async (batchId: string) => {
    setLoadingSemesters(true);
    setSemesters([]);
    setSelectedSemesterId("");
    try {
      const res = await fetch(`/api/batch-semesters?batchId=${batchId}`);
      const json = await res.json();
      setSemesters(json.data ?? json);
    } catch (error) {
        console.error("[CreateWizard]", error);
        feedback.error("Could not load semesters");
    } finally {
      setLoadingSemesters(false);
    }
  }, []);

  const loadSubjects = useCallback(async (batchSemesterId: string) => {
    setLoadingSubjects(true);
    setSubjects([]);
    setRemovedSubjectIds(new Set());
    try {
      const result = await getSubjectsForBatchSemester(batchSemesterId);
      setSubjects(result);
    } catch (error) {
        console.error("[CreateWizard]", error);
        feedback.error("Could not load subjects");
    } finally {
      setLoadingSubjects(false);
    }
  }, []);

  function handleBatchChange(batchId: string) {
    setSelectedBatchId(batchId);
    setSelectedSemesterId("");
    setSelectedExamType("");
    setSubjects([]);
    setRemovedSubjectIds(new Set());
    if (batchId) loadSemesters(batchId);
  }

  function handleSemesterChange(semesterId: string) {
    setSelectedSemesterId(semesterId);
    setSelectedExamType("");
    setSubjects([]);
    setRemovedSubjectIds(new Set());
    if (semesterId) loadSubjects(semesterId);
  }

  function toggleSubject(subjectId: string) {
    setRemovedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  }

  const canProceedToStep2 = selectedBatchId && selectedSemesterId && selectedExamType;
  const canProceedToStep3 = canProceedToStep2 && !loadingSubjects && visibleSubjects.length > 0;

  async function handleCreate() {
    if (!selectedSemesterId || !selectedExamType || !selectedBatch) return;
    setSubmitting(true);

    // eslint-disable-next-line react-hooks/purity
    const timestamp = Date.now();
    try {
      const body = {
        batchSemesterId: selectedSemesterId,
        examType: selectedExamType,
        status: "DRAFT",
        timetableDocumentRef: `EC-${timestamp.toString(36).toUpperCase()}`,
        timetableIssueDate: new Date(timestamp).toISOString(),
        timetableTitle: `${selectedBatch.name} - Semester ${selectedSemester?.semesterNumber} - ${examTypeLabels[selectedExamType as keyof typeof examTypeLabels] ?? selectedExamType}`,
        timetableRows: [{ dateDay: "TBD", time: "TBD", paper: "TBD" }],
        timetableSignature: "COE",
        subjectOverrides: visibleSubjects.map((s) => s.subjectId),
      };

      const res = await apiFetch("/api/exam-cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error("[CreateWizard]", json);
        const msg = json.error?.message ?? json.error ?? "Could not create exam cycle";
        feedback.error(msg);
        return;
      }

      feedback.success({ title: "Exam cycle created successfully", description: "Subjects can now be linked to this cycle" });
      router.push(`/dashboard/coe/exam-cycles/${json.data.id}`);
    } catch (error) {
      console.error("[CreateWizard]", error);
      feedback.error("Unable to reach the server. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <WizardProgress currentStep={step} />

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Select Academic Context</h2>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              Choose which batch and semester this exam cycle belongs to. The system will load the curriculum automatically.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Batch</label>
                <p className="text-xs text-[var(--text-tertiary)] mb-2">Select the student batch for this examination.</p>
                <select
                  className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent)]"
                  value={selectedBatchId}
                  onChange={(e) => handleBatchChange(e.target.value)}
                >
                  <option value="">{loadingBatches ? "Loading..." : "Select a batch..."}</option>
                  {batches.filter((b) => b.curriculumScheme).map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.department?.name ?? '-'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Semester</label>
                <p className="text-xs text-[var(--text-tertiary)] mb-2">Which semester is being examined?</p>
                <select
                  className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent)] disabled:opacity-50"
                  value={selectedSemesterId}
                  onChange={(e) => handleSemesterChange(e.target.value)}
                  disabled={!selectedBatchId || loadingSemesters}
                >
                  <option value="">{loadingSemesters ? "Loading..." : !selectedBatchId ? "Select a batch first" : "Select a semester..."}</option>
                  {semesters.map((s) => (
                    <option key={s.id} value={s.id}>Semester {s.semesterNumber} ({s.academicYear?.code ?? '-'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Exam Type</label>
                <p className="text-xs text-[var(--text-tertiary)] mb-2">What type of examination is this?</p>
                <select
                  className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--accent)] disabled:opacity-50"
                  value={selectedExamType}
                  onChange={(e) => setSelectedExamType(e.target.value)}
                  disabled={!selectedSemesterId}
                >
                  <option value="">{!selectedSemesterId ? "Select a semester first" : "Select exam type..."}</option>
                  {EXAM_TYPES.map((et) => (
                    <option key={et} value={et}>{examTypeLabels[et as keyof typeof examTypeLabels] ?? et}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedBatch && selectedSemester && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-[var(--text-tertiary)]">Selection Summary</p>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--text-tertiary)]">Department</span>
                      <span className="text-sm font-medium">{selectedBatch.department?.name ?? '-'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--text-tertiary)]">Batch</span>
                      <span className="text-sm font-medium">{selectedBatch.name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--text-tertiary)]">Semester</span>
                      <span className="text-sm font-medium">Semester {selectedSemester.semesterNumber}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--text-tertiary)]">Curriculum Scheme</span>
                      <span className="text-sm font-medium">{selectedBatch.curriculumScheme?.name ?? '-'} ({selectedBatch.curriculumScheme?.year ?? '-'})</span>
                    </div>
                    {selectedExamType && (
                      <div className="flex justify-between items-center pt-2 border-t border-[var(--border)]">
                        <span className="text-sm text-[var(--text-tertiary)]">Exam Type</span>
                        <Badge variant="info">{examTypeLabels[selectedExamType as keyof typeof examTypeLabels] ?? selectedExamType}</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <p className="text-xs text-[var(--text-tertiary)]">
                  The curriculum scheme shown is from the batch. Subjects will be loaded from this scheme for the selected semester and department.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-[var(--border)]">
            <Button onClick={() => setStep(2)} disabled={!canProceedToStep2}>
              Continue to Subjects
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          {selectedBatch && !selectedBatch.curriculumScheme && (
            <EntityStatusBanner
              items={[{
                id: "no-curriculum",
                title: "No Curriculum Scheme Assigned",
                description: "This batch has no curriculum scheme assigned. Please ensure curriculum is set up before creating exam cycles.",
                severity: "warning",
              }]}
            />
          )}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Review Subjects</h2>
              <p className="mt-1 text-sm text-[var(--text-tertiary)]">
                These subjects from the curriculum will be included in this exam cycle. Remove any that should not appear.
              </p>
            </div>
            <Badge variant="info" className="text-sm px-3 py-1">
              {visibleSubjects.length} of {subjects.length} subjects selected
            </Badge>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {selectedBatch?.name} — Semester {selectedSemester?.semesterNumber}
              </CardTitle>
              <CardDescription>
                {selectedBatch?.department?.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingSubjects ? (
                <div className="space-y-3 p-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-lg bg-[var(--surface-hover)]" />
                  ))}
                </div>
              ) : subjects.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-[var(--text-tertiary)]">No subjects found for this semester in the curriculum.</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">Add subjects to the curriculum first, then create the exam cycle.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {subjects.map((subject) => {
                    const removed = removedSubjectIds.has(subject.subjectId);
                    return (
                      <div
                        key={subject.subjectId}
                        className={`flex items-center gap-4 px-6 py-3 transition-colors ${removed ? "opacity-40" : "hover:bg-[var(--surface-hover)]"}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSubject(subject.subjectId)}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                            removed ? "border-[var(--border)]" : "border-green-500 bg-green-500"
                          }`}
                        >
                          {!removed && (
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{subject.subjectName}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">
                            {subject.subjectCode} · {subject.credits} credits · {subject.departmentName}
                            {subject.groupAssignment !== "ALL" && ` · ${subject.groupAssignment.replace("_", " ")}`}
                          </p>
                        </div>
                        <span className={`text-xs ${removed ? "text-[var(--text-tertiary)]" : "text-green-600 font-medium"}`}>
                          {removed ? "Removed" : "Included"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {subjects.length > 0 && (
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4 flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-800">Removing a subject from the list means it will not be included in this exam cycle.</p>
                  <p className="text-xs text-amber-700 mt-1">You can add subjects back later from the exam cycle detail page.</p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-between pt-4 border-t border-[var(--border)]">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)} disabled={!canProceedToStep3}>
              Continue to Review
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Review & Confirm</h2>
            <p className="mt-1 text-sm text-[var(--text-tertiary)]">
              Verify all details before creating the exam cycle.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Academic Information</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Department</span><span className="font-medium">{selectedBatch?.department?.name ?? '-'}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Batch</span><span className="font-medium">{selectedBatch?.name}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Semester</span><span className="font-medium">Semester {selectedSemester?.semesterNumber}</span></div>
                <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Curriculum</span><span className="font-medium">{selectedBatch?.curriculumScheme?.name} ({selectedBatch?.curriculumScheme?.year})</span></div>
                <div className="flex justify-between pt-2 border-t border-[var(--border)]"><span className="text-[var(--text-tertiary)]">Exam Type</span><Badge variant="info">{selectedExamType ? examTypeLabels[selectedExamType as keyof typeof examTypeLabels] ?? selectedExamType : '-'}</Badge></div>
                <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Status</span><Badge variant="warning">Draft</Badge></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Subjects ({visibleSubjects.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="max-h-60 space-y-1.5 overflow-y-auto">
                  {visibleSubjects.map((s) => (
                    <div key={s.subjectId} className="flex items-center justify-between rounded-md bg-[var(--surface-hover)] px-3 py-1.5 text-sm">
                      <span className="font-medium">{s.subjectCode}</span>
                      <span className="text-xs text-[var(--text-tertiary)]">{s.subjectName}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4 flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">Duplicate check</p>
                <p className="text-xs text-amber-700 mt-1">
                  The system will prevent creating a duplicate exam cycle for the same batch semester and exam type combination.
                  {removedSubjectIds.size > 0 && ` ${removedSubjectIds.size} subject(s) have been removed from the list.`}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between pt-4 border-t border-[var(--border)]">
            <Button variant="outline" onClick={() => setStep(2)} disabled={submitting}>Back</Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating...
                </span>
              ) : (
                "Create Exam Cycle"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
