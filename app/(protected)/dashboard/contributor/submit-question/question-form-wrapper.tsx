"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { QuestionForm } from "@/components/forms/question-form";
import type { SlotInfo } from "@/components/forms/slot-demand";

type SubjectVersionItem = { id: string; title: string; subject: { subjectCode: string; subjectName: string } };

export function QuestionFormWrapper({
  subjectVersions,
  endpoint,
  title,
  redirectOnSuccess,
  initialValues,
  slotDataMap,
  bankIdBySubjectVersionId,
  currentSubjectVersionId,
}: {
  subjectVersions: SubjectVersionItem[];
  endpoint: string;
  title: string;
  redirectOnSuccess: string;
  initialValues?: { subjectVersionId?: string; moduleNumber?: number; marks?: number };
  slotDataMap?: Record<string, SlotInfo[]>;
  bankIdBySubjectVersionId?: Record<string, string>;
  currentSubjectVersionId?: string;
}) {
  const router = useRouter();

  const selectedSubjectVersionId = initialValues?.subjectVersionId ?? currentSubjectVersionId;

  const bankId = useMemo(() => {
    if (!selectedSubjectVersionId || !bankIdBySubjectVersionId) return undefined;
    return bankIdBySubjectVersionId[selectedSubjectVersionId];
  }, [selectedSubjectVersionId, bankIdBySubjectVersionId]);

  return (
    <QuestionForm
      subjectVersions={subjectVersions}
      endpoint={endpoint}
      title={title}
      redirectOnSuccess={redirectOnSuccess}
      initialValues={initialValues}
      slotDataMap={slotDataMap}
      bankId={bankId}
      onSuccessAction="stay"
      onSubmitAnother={() => {
        const params = new URLSearchParams();
        if (currentSubjectVersionId) params.set("subjectVersionId", currentSubjectVersionId);
        router.push(`?${params.toString()}`);
      }}
    />
  );
}
