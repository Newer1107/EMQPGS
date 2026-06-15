"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

type NextStep = {
  label: string;
  description: string;
  href?: string;
  action?: string;
};

const GUIDANCE_MAP: Record<string, NextStep[]> = {
  subject_created: [
    { label: "Create Question Bank", description: "Link this subject to an exam cycle and create a question bank.", href: "/dashboard/coordinator/question-banks" },
  ],
  bank_created: [
    { label: "Assign Contributors", description: "Add contributors to start filling the question bank.", href: "/dashboard/coordinator/assignments" },
    { label: "Create Questions", description: "Add questions to the bank to fill module slots." },
  ],
  bank_submitted: [
    { label: "Wait for Moderation", description: "Moderators will review submitted questions. Track progress on the bank detail page." },
  ],
  moderation_complete: [
    { label: "Generate AI Report", description: "Run an AI analysis to check question quality and coverage." },
  ],
  report_generated: [
    { label: "Upload Signed Report", description: "HOD must upload a signed report to proceed." },
  ],
  bank_approved: [
    { label: "Lock Question Bank", description: "Lock the bank to proceed with paper generation and dean review." },
  ],
  bank_locked: [
    { label: "Dean Review", description: "Dean will review generated papers and make a selection." },
  ],
  dean_reviewed: [
    { label: "Export Papers", description: "Export the final selected papers for printing and distribution.", href: "/dashboard/coe/production" },
  ],
  question_created: [
    { label: "Submit for Moderation", description: "Submit your question so a moderator can review it.", href: "/dashboard/contributor/questions" },
  ],
  question_submitted: [
    { label: "Awaiting Review", description: "A moderator will review your question. Check back for status updates.", href: "/dashboard/contributor/questions" },
  ],
};

type NextStepGuidanceProps = {
  context: string;
  title?: string;
};

export function NextStepGuidance({ context, title = "What happens next?" }: NextStepGuidanceProps) {
  const steps = GUIDANCE_MAP[context];
  if (!steps || steps.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold text-amber-800 mb-2">{title}</h3>
        <ul className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-amber-700">
              <span className="mt-0.5 text-amber-500">→</span>
              <div>
                {step.href ? (
                  <Link href={step.href} className="font-medium underline underline-offset-2 hover:text-amber-900">
                    {step.label}
                  </Link>
                ) : (
                  <span className="font-medium">{step.label}</span>
                )}
                <p className="text-xs text-amber-600">{step.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
