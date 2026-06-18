"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { questionStatusLabels } from "@/lib/constants";

const MODULES = [1, 2, 3, 4, 5, 6];
const MARKS = [2, 5, 10];

type QuestionData = {
  moduleNumber: number;
  marks: number;
  status: string;
  id: string;
};

type SlotCoverageDashboardProps = {
  questions: QuestionData[];
};

export function SlotCoverageDashboard({ questions }: SlotCoverageDashboardProps) {
  const approved = questions.filter((q) => q.status === "APPROVED");
  const pending = questions.filter((q) => q.status === "PENDING" || q.status === "REVISION_SUBMITTED");
  const draft = questions.filter((q) => q.status === "DRAFT");

  const getSlotStatus = (module: number, marks: number) => {
    const slotQuestions = questions.filter((q) => q.moduleNumber === module && q.marks === marks);
    const approvedCount = slotQuestions.filter((q) => q.status === "APPROVED").length;
    const pendingCount = slotQuestions.filter((q) => q.status === "PENDING" || q.status === "REVISION_SUBMITTED").length;
    const totalCount = slotQuestions.length;

    return { approvedCount, pendingCount, totalCount };
  };

  const totalModules = MODULES.length * MARKS.length;
  const filledModules = questions.length > 0 ? new Set(questions.map((q) => `${q.moduleNumber}-${q.marks}`)).size : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coverage Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <span>Approved: <Badge className="bg-green-600">{approved.length}</Badge></span>
          <span>Pending Review: <Badge className="bg-amber-500">{pending.length}</Badge></span>
          <span>Draft: <Badge className="bg-gray-400">{draft.length}</Badge></span>
          <span>Module-Marks Filled: <Badge>{filledModules}/{totalModules}</Badge></span>
        </div>
        <div className="space-y-4">
          {MODULES.map((module) => (
            <div key={module}>
              <h4 className="text-sm font-medium mb-2 text-[var(--text-primary)]">Module {module}</h4>
              <div className="grid grid-cols-3 gap-3">
                {MARKS.map((marks) => {
                  const slot = getSlotStatus(module, marks);
                  const isComplete = slot.approvedCount > 0;
                  const isUnderfilled = slot.totalCount > 0 && slot.approvedCount === 0;
                  const isMissing = slot.totalCount === 0;

                  let bgClass = "bg-gray-100 border-gray-200";
                  let label = "Missing";
                  let textClass = "text-gray-400";
                  if (isComplete) { bgClass = "bg-green-50 border-green-200"; label = `${slot.approvedCount} Approved`; textClass = "text-green-700"; }
                  if (isUnderfilled) { bgClass = "bg-amber-50 border-amber-200"; label = `${slot.totalCount} Total, 0 Approved`; textClass = "text-amber-700"; }

                  return (
                    <div key={`${module}-${marks}`} className={`rounded-lg border p-3 ${bgClass}`}>
                      <p className="text-xs font-semibold text-[var(--text-primary)]">{marks} Marks</p>
                      <p className={`text-xs mt-1 ${textClass}`}>{label}</p>
                      {slot.pendingCount > 0 && (
                        <p className="text-xs text-amber-600 mt-0.5">{slot.pendingCount} pending</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
