"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { X, Plus, User, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { feedback } from "@/lib/feedback";

export interface UserInfo {
  id: string;
  name: string;
  email: string;
}

export interface InlineAssignPanelProps {
  bankId: string;
  role: "CONTRIBUTOR" | "MODERATOR";
  title: string;
  currentAssignments: UserInfo[];
  onAssign: (userId: string) => Promise<{ success: boolean; error?: string }>;
  onUnassign: (userId: string) => Promise<{ success: boolean; error?: string }>;
  availableUsers: UserInfo[];
  className?: string;
}

export function InlineAssignPanel({
  bankId: _bankId,
  role,
  title,
  currentAssignments: initialAssignments,
  onAssign,
  onUnassign,
  availableUsers,
  className,
}: InlineAssignPanelProps) {
  const [loading, setLoading] = useState(false);
  const [localAssignments, setLocalAssignments] = useState(initialAssignments);
  const [selectedUserId, setSelectedUserId] = useState("");

  const assignedIds = new Set(localAssignments.map((a) => a.id));
  const unassignedUsers = availableUsers.filter((u) => !assignedIds.has(u.id));

  async function handleAssign() {
    if (!selectedUserId || loading) return;
    const userId = selectedUserId;
    const user = availableUsers.find((u) => u.id === userId);
    if (!user) return;

    setLoading(true);
    setLocalAssignments((prev) => [...prev, user]);
    setSelectedUserId("");

    const result = await onAssign(userId);
    if (result.success) {
      feedback.success({ title: `${role} assigned`, description: `${role} can now access the bank` });
    } else {
      console.error("[InlineAssignPanel]", result.error);
      setLocalAssignments((prev) => prev.filter((a) => a.id !== userId));
      feedback.error(result.error ?? `Could not assign ${role.toLowerCase()}`);
    }
    setLoading(false);
  }

  async function handleUnassign(userId: string) {
    if (loading) return;
    const user = localAssignments.find((a) => a.id === userId);
    if (!user) return;

    setLoading(true);
    setLocalAssignments((prev) => prev.filter((a) => a.id !== userId));

    const result = await onUnassign(userId);
    if (result.success) {
      feedback.success({ title: `${role} unassigned`, description: `${role} access removed` });
    } else {
      console.error("[InlineAssignPanel]", result.error);
      setLocalAssignments((prev) => [...prev, user]);
      feedback.error(result.error ?? `Could not unassign ${role.toLowerCase()}`);
    }
    setLoading(false);
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {title}
          <Badge>{localAssignments.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {localAssignments.length > 0 ? (
          <ul className="space-y-2">
            {localAssignments.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--surface-hover)] text-[var(--text-secondary)]">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--text-primary)]">
                      {user.name}
                    </p>
                    <p className="flex items-center gap-1 truncate text-xs text-[var(--text-tertiary)]">
                      <Mail className="h-3 w-3 shrink-0" />
                      {user.email}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleUnassign(user.id)}
                  disabled={loading}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-tertiary)] transition-colors hover:bg-[var(--danger-bg)] hover:text-[var(--danger)] disabled:opacity-50"
                  aria-label={`Unassign ${user.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-[var(--text-tertiary)]">
            No {role.toLowerCase()}s assigned
          </p>
        )}

        {unassignedUsers.length > 0 && (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                Assign {role.toLowerCase()}
              </label>
              <Select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                <option value="">Select a {role.toLowerCase()}...</option>
                {unassignedUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </Select>
            </div>
            <Button
              onClick={handleAssign}
              disabled={!selectedUserId}
              loading={loading}
              size="sm"
            >
              <Plus className="h-4 w-4" />
              Assign
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
