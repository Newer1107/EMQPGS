import type { Metadata } from "next";
import Link from "next/link";
import { CreateExamCycleWizard } from "@/components/exam-cycles/create-wizard";

export const metadata: Metadata = { title: "Create Exam Cycle — EMQPGS" };

export default function CreateExamCyclePage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/coe/exam-cycles" className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
          &larr; Back to Exam Cycles
        </Link>
      </div>
      <CreateExamCycleWizard />
    </div>
  );
}
