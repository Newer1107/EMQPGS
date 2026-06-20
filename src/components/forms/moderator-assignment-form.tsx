"use client";

import { useState } from "react";
import { feedback } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/client-fetch";
import { useRouter } from "next/navigation";

type ModeratorAssignmentFormProps = {
  questionBanks: Array<{ id: string; subject: { subjectCode: string; subjectName: string }; batchSemester: { semesterNumber: number; academicYear: { code: string } } }>;
  moderators: Array<{ id: string; name: string; email: string }>;
  existingAssignments: Array<{ id: string; questionBankId: string; moderatorId: string; moderator: { name: string }; questionBank: { subject: { subjectCode: string }; batchSemester: { semesterNumber: number } } }>;
};

export function ModeratorAssignmentForm({ questionBanks, moderators, existingAssignments }: ModeratorAssignmentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [questionBankId, setQuestionBankId] = useState("");
  const [moderatorId, setModeratorId] = useState("");

  async function handleAssign(event: React.FormEvent) {
    event.preventDefault();
    if (!questionBankId || !moderatorId) {
      feedback.error("Please select both a question bank and a moderator.");
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch(`/api/question-banks/${questionBankId}/assignments/moderator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moderatorId }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        feedback.success({ title: "Moderator assigned successfully", description: "They can now review questions in this bank" });
        setQuestionBankId("");
        setModeratorId("");
        router.refresh();
      } else {
        console.error("[ModeratorAssignmentForm]", result.error ?? result);
        feedback.error(result.error?.message ?? "Could not assign moderator");
      }
    } catch (error) {
      console.error("[ModeratorAssignmentForm]", error);
      feedback.error("Unable to reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Assign Moderator</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAssign} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="questionBankId">Question Bank</Label>
                <Select id="questionBankId" value={questionBankId} onChange={(e) => setQuestionBankId(e.target.value)} required>
                  <option value="">Select</option>
                  {questionBanks.map((qb) => (
                    <option key={qb.id} value={qb.id}>
                      {qb.subject.subjectCode} - {qb.subject.subjectName} (Sem {qb.batchSemester.semesterNumber} · {qb.batchSemester.academicYear.code})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="moderatorId">Moderator</Label>
                <Select id="moderatorId" value={moderatorId} onChange={(e) => setModeratorId(e.target.value)} required>
                  <option value="">Select</option>
                  {moderators.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.email})</option>
                  ))}
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={loading || !questionBankId || !moderatorId} className="w-full">
              {loading ? "Assigning..." : "Assign Moderator"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Assignments ({existingAssignments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {existingAssignments.length > 0 ? (
            <Table>
              <THead><TR><TH>Question Bank</TH><TH>Exam Cycle</TH><TH>Moderator</TH></TR></THead>
              <TBody>
                {existingAssignments.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-medium">{a.questionBank.subject.subjectCode}</TD>
                    <TD>Sem {a.questionBank.batchSemester.semesterNumber}</TD>
                    <TD><Badge>{a.moderator.name}</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="text-sm text-[var(--text-tertiary)]">No moderators assigned yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
