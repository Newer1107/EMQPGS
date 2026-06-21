"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { responsibilityLabels } from "@/lib/constants";
import { apiFetch } from "@/lib/client-fetch";
import type { ResponsibilityType, ScopeType } from "@prisma/client";

type ResponsibilityOption = {
  id: string;
  type: ResponsibilityType;
  scopeType: ScopeType;
  scopeId: string | null;
};

export function WorkspacePicker({
  responsibilities,
  userName,
}: {
  responsibilities: ResponsibilityOption[];
  userName: string;
}) {
  const router = useRouter();

  async function enterWorkspace(assignmentId: string) {
    const res = await apiFetch("/api/auth/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId }),
    });
    const result = await res.json();
    if (!result.success) return; // error handling omitted for brevity
    const type = result.data.responsibility.toLowerCase();
    router.push(`/dashboard/${type}`);
  }

  function getScopeLabel(r: ResponsibilityOption): string {
    if (r.scopeType === "INSTITUTION" || !r.scopeId) return "Institution-wide";
    return `${r.scopeType} #${r.scopeId.slice(0, 8)}`;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome, {userName}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            You have access to multiple workspaces. Choose one to continue.
          </p>
        </div>

        <div className="space-y-3">
          {responsibilities.map((r) => (
            <Card
              key={r.id}
              className="cursor-pointer transition-colors hover:border-neutral-300 hover:bg-neutral-50"
              onClick={() => enterWorkspace(r.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {responsibilityLabels[r.type] ?? r.type}
                </CardTitle>
                <CardDescription>
                  {getScopeLabel(r)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" className="w-full">
                  Enter Workspace
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
