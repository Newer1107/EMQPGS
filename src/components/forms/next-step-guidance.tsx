"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

type NextStep = {
  label: string;
  description: string;
  href?: string;
};

const GUIDANCE_MAP: Record<string, NextStep[]> = {
  subject_created: [
    { label: "Create Question Bank", description: "Link this subject to an exam cycle and create a question bank.", href: "/dashboard/coordinator/question-banks" },
  ],
  bank_created: [
    { label: "Assign Contributors", description: "Add contributors to start filling the question bank.", href: "/dashboard/coordinator/assignments" },
  ],
  question_created: [
    { label: "Submit for Moderation", description: "Submit your question so a moderator can review it.", href: "/dashboard/contributor/questions" },
  ],
  question_submitted: [
    { label: "Wait for Moderation", description: "A moderator will review your question. Check back for feedback." },
  ],
};

const PHASE_GUIDANCE: Record<string, NextStep[]> = {
  DRAFTING: [
    { label: "Assign Contributors", description: "Add contributors to start filling the question bank.", href: "/dashboard/coordinator/assignments" },
    { label: "Fill Slots", description: "Assign questions to all 126 slots across modules and marks." },
  ],
  MODERATION: [
    { label: "Moderator Review", description: "Moderators are reviewing submitted questions. Track progress on the bank detail page." },
  ],
  APPROVAL: [
    { label: "Generate AI Report", description: "Run an AI analysis to check question quality and coverage." },
    { label: "Review and Decide", description: "Review the AI report and approve or reject the bank." },
  ],
  COMPLETE: [
    { label: "Generate Papers", description: "Generate paper variants A, B, C." },
    { label: "Dean Review", description: "Assign papers to exam slots via dean review." },
    { label: "Lock Bank", description: "Lock the bank to preserve the final state." },
  ],
};

type NextStepGuidanceProps = {
  phase?: string;
  recordStatus?: string;
  context?: string;
};

export function NextStepGuidance({ phase, recordStatus, context }: NextStepGuidanceProps) {
  const steps = context ? GUIDANCE_MAP[context] ?? [] : PHASE_GUIDANCE[phase ?? ""] ?? [];

  if (recordStatus === "LOCKED") {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-[var(--muted-foreground)]">Bank is locked. Proceed to dean review and export.</p>
        </CardContent>
      </Card>
    );
  }

  if (steps.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium text-[var(--foreground)]">Next Steps</p>
        {steps.map((step) => (
          <div key={step.label} className="text-sm">
            {step.href ? (
              <Link href={step.href} className="font-medium text-blue-600 hover:underline">
                {step.label}
              </Link>
            ) : (
              <span className="font-medium">{step.label}</span>
            )}
            <p className="text-[var(--muted-foreground)] mt-0.5">{step.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
