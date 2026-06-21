"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { responsibilityLabels } from "@/lib/constants";
import type { ResponsibilityType, ScopeType } from "@prisma/client";

type WorkspaceOption = {
  id: string;
  type: ResponsibilityType;
  scopeType: ScopeType;
  scopeName?: string;
};

export function WorkspaceSwitcher({
  currentAssignmentId,
  workspaces,
}: {
  currentAssignmentId?: string;
  workspaces: WorkspaceOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const current = workspaces.find((w) => w.id === currentAssignmentId);
  const others = workspaces.filter((w) => w.id !== currentAssignmentId);

  function switchWorkspace(assignmentId: string) {
    localStorage.setItem("lastWorkspace", assignmentId);
    setOpen(false);
    router.push(`/api/auth/workspace?assignmentId=${assignmentId}&redirect=/dashboard`);
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-sm"
        onClick={() => setOpen(!open)}
      >
        <span className="text-[var(--text-primary)]">
          {current ? responsibilityLabels[current.type] ?? current.type : "Workspace"}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-[var(--border)] bg-white p-1 shadow-lg">
            <p className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              Switch Workspace
            </p>
            {workspaces.map((w) => (
              <button
                key={w.id}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-hover)] ${
                  w.id === currentAssignmentId
                    ? "bg-[var(--surface-hover)] font-medium text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)]"
                }`}
                onClick={() => switchWorkspace(w.id)}
              >
                <div className="flex-1">
                  <p className="text-sm">{responsibilityLabels[w.type] ?? w.type}</p>
                  {w.scopeName && (
                    <p className="text-xs text-[var(--text-tertiary)]">{w.scopeName}</p>
                  )}
                </div>
                {w.id === currentAssignmentId && (
                  <span className="text-xs text-[var(--text-tertiary)]">Active</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
