"use client";

import { useState } from "react";
import { ModeratorAssignmentForm } from "@/components/forms/moderator-assignment-form";
import { ContributorAssignmentForm } from "@/components/forms/contributor-assignment-form";
import { Search } from "lucide-react";

type QuestionBank = {
  id: string;
  subject: { subjectCode: string; subjectName: string };
  batchSemester: { semesterNumber: number; academicYear: { code: string } };
};

type ModeratorAssignment = {
  id: string;
  questionBankId: string;
  moderatorId: string;
  moderator: { name: string };
  questionBank: { subject: { subjectCode: string }; batchSemester: { semesterNumber: number } };
};

type ContributorAssignment = {
  id: string;
  questionBankId: string;
  contributorId: string;
  contributor: { name: string };
  questionBank: { subject: { subjectCode: string }; batchSemester: { semesterNumber: number } };
};

export function AssignmentsClient({
  questionBanks,
  moderators,
  existingModeratorAssignments,
  contributors,
  existingContributorAssignments,
}: {
  questionBanks: QuestionBank[];
  moderators: Array<{ id: string; name: string; email: string }>;
  existingModeratorAssignments: ModeratorAssignment[];
  contributors: Array<{ id: string; name: string; email: string }>;
  existingContributorAssignments: ContributorAssignment[];
}) {
  const [search, setSearch] = useState("");

  const q = search.toLowerCase().trim();

  const filteredBanks = q
    ? questionBanks.filter(
        (b) =>
          b.subject.subjectCode.toLowerCase().includes(q) ||
          b.subject.subjectName.toLowerCase().includes(q),
      )
    : questionBanks;

  const filteredModAssignments = q
    ? existingModeratorAssignments.filter(
        (a) =>
          a.questionBank.subject.subjectCode.toLowerCase().includes(q) ||
          a.moderator.name.toLowerCase().includes(q),
      )
    : existingModeratorAssignments;

  const filteredContribAssignments = q
    ? existingContributorAssignments.filter(
        (a) =>
          a.questionBank.subject.subjectCode.toLowerCase().includes(q) ||
          a.contributor.name.toLowerCase().includes(q),
      )
    : existingContributorAssignments;

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          type="text"
          placeholder="Search by bank name or user name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border border-[var(--border)] bg-white pl-10 pr-4 text-sm outline-none placeholder:text-[var(--text-tertiary)] focus:border-[var(--foreground)]"
        />
      </div>
      <ModeratorAssignmentForm
        questionBanks={filteredBanks}
        moderators={moderators}
        existingAssignments={filteredModAssignments}
      />
      <ContributorAssignmentForm
        questionBanks={filteredBanks}
        contributors={contributors}
        existingAssignments={filteredContribAssignments}
      />
    </div>
  );
}
