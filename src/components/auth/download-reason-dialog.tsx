"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const REASONS = [
  { value: "EXAM_PRINTING", label: "Exam Printing" },
  { value: "QUALITY_REVIEW", label: "Quality Review" },
  { value: "ARCHIVE", label: "Archive" },
  { value: "OTHER", label: "Other" },
] as const;

interface DownloadReasonDialogProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function DownloadReasonDialog({ onConfirm, onCancel }: DownloadReasonDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");

  const handleConfirm = () => {
    const reason = selected === "OTHER" ? `OTHER:${otherText}` : selected!;
    onConfirm(reason);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-[var(--card)] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--surface-hover)]">
            <Download className="h-5 w-5 text-[var(--text-primary)]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Select Download Reason
            </h3>
            <p className="text-sm text-[var(--text-tertiary)]">
              Please specify why you are downloading this paper
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {REASONS.map((r) => (
            <label
              key={r.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                selected === r.value
                  ? "border-[var(--accent)] bg-[var(--surface-hover)]"
                  : "border-[var(--border)] hover:bg-[var(--surface-hover)]"
              }`}
            >
              <input
                type="radio"
                name="downloadReason"
                value={r.value}
                checked={selected === r.value}
                onChange={() => setSelected(r.value)}
                className="h-4 w-4 text-[var(--accent)] accent-[var(--accent)]"
              />
              <span className="text-sm text-[var(--text-primary)]">{r.label}</span>
            </label>
          ))}
        </div>

        {selected === "OTHER" && (
          <input
            type="text"
            value={otherText}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="Please specify..."
            className="mt-3 flex h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none transition-colors focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            autoFocus
          />
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selected || (selected === "OTHER" && !otherText.trim())}>
            Continue Download
          </Button>
        </div>
      </div>
    </div>
  );
}
