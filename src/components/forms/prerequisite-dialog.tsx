"use client";

import { Button } from "@/components/ui/button";

type Props = {
  missing: string[];
  existing: string[];
  durationSemesters: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
};

export function PrerequisiteDialog({ missing, existing, durationSemesters, onConfirm, onCancel, loading }: Props) {
  const academicYearCount = missing.length;
  const yearSpanCount = existing.length + missing.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold">Additional setup required</h3>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          The selected curriculum contains {durationSemesters} semesters. Those semesters span {yearSpanCount} Academic
          Years.
        </p>

        {existing.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">Already Exists</p>
            <div className="mt-1 space-y-1">
              {existing.map((code) => (
                <div key={code} className="flex items-center gap-2 text-sm text-green-600">
                  <span className="text-green-500">&#10003;</span> {code}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3">
          <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
            {existing.length > 0 ? "Will Be Created" : "Required"}
          </p>
          <div className="mt-1 space-y-1">
            {missing.map((code) => (
              <div key={code} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--text-tertiary)]">&bull;</span> {code}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-xs text-[var(--text-tertiary)]">No existing data will be modified.</p>

        <div className="mt-2 rounded-lg border bg-gray-50 px-3 py-2">
          <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wide">This operation will create</p>
          <div className="mt-1 space-y-0.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-tertiary)]">&bull;</span> {academicYearCount} Academic Year{academicYearCount !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-tertiary)]">&bull;</span> 1 Batch
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--text-tertiary)]">&bull;</span> {durationSemesters} Batch Semester{durationSemesters !== 1 ? "s" : ""}
            </div>
          </div>
          {existing.length === 0 && (
            <p className="mt-2 text-xs text-amber-600">
              No existing Academic Year was found to copy date patterns from. New Academic Years will be created in Draft
              status. Please review and set dates before activating them.
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? "Working..." : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
