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

type ContributorAssignmentFormProps = {
  questionBanks: Array<{ id: string; subject: { subjectCode: string; subjectName: string }; examCycle: { examType: string; semester: { name: string }; academicYear: { code: string } } }>;
  contributors: Array<{ id: string; name: string; email: string }>;
  existingAssignments: Array<{ id: string; questionBankId: string; contributorId: string; contributor: { name: string }; questionBank: { subject: { subjectCode: string }; examCycle: { examType: string } } }>;
};

export function ContributorAssignmentForm({ questionBanks, contributors, existingAssignments }: ContributorAssignmentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [questionBankId, setQuestionBankId] = useState("");
  const [contributorId, setContributorId] = useState("");

  async function handleAssign(event: React.FormEvent) {
    event.preventDefault();
    if (!questionBankId || !contributorId) {
      feedback.error("Please select both a question bank and a contributor.");
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch(`/api/question-banks/${questionBankId}/assignments/contributor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contributorId }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        feedback.success({ title: "Contributor assigned successfully" });
        setQuestionBankId("");
        setContributorId("");
        router.refresh();
      } else {
        feedback.error(result.error?.message ?? "Assignment failed");
      }
    } catch {
      feedback.error("Network request failed. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Assign Contributor</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAssign} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contributor-qb">Question Bank</Label>
                <Select id="contributor-qb" value={questionBankId} onChange={(e) => setQuestionBankId(e.target.value)} required>
                  <option value="">Select</option>
                  {questionBanks.map((qb) => (
                    <option key={qb.id} value={qb.id}>
                      {qb.subject.subjectCode} - {qb.subject.subjectName} ({qb.examCycle.examType} · {qb.examCycle.semester.name} {qb.examCycle.academicYear.code})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="contributorId">Contributor</Label>
                <Select id="contributorId" value={contributorId} onChange={(e) => setContributorId(e.target.value)} required>
                  <option value="">Select</option>
                  {contributors.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.email})</option>
                  ))}
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={loading || !questionBankId || !contributorId} className="w-full">
              {loading ? "Assigning..." : "Assign Contributor"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Contributor Assignments ({existingAssignments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {existingAssignments.length > 0 ? (
            <Table>
              <THead><TR><TH>Question Bank</TH><TH>Exam Cycle</TH><TH>Contributor</TH></TR></THead>
              <TBody>
                {existingAssignments.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-medium">{a.questionBank.subject.subjectCode}</TD>
                    <TD>{a.questionBank.examCycle.examType}</TD>
                    <TD><Badge>{a.contributor.name}</Badge></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="text-sm text-[var(--text-tertiary)]">No contributors assigned yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
