"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client-fetch";

type WorkspaceDisplay = {
  title: string;
  subtitle?: string;
  tertiary?: string;
};

type ResponsibilityOption = {
  id: string;
  display: WorkspaceDisplay;
};

export function WorkspacePicker({
  responsibilities,
  userName,
}: {
  responsibilities: ResponsibilityOption[];
  userName: string;
}) {
  async function enterWorkspace(assignmentId: string) {
    localStorage.setItem("lastWorkspace", assignmentId);
    const res = await apiFetch("/api/auth/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId }),
    });
    const result = await res.json();
    if (!result.success) return;
    const type = result.data.responsibility.toLowerCase();
    window.location.href = `/dashboard/${type}`;
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
                <CardTitle className="text-base">{r.display.title}</CardTitle>
                {r.display.subtitle && (
                  <CardDescription>
                    {r.display.subtitle}
                    {r.display.tertiary && <><br /><span className="text-[11px]">{r.display.tertiary}</span></>}
                  </CardDescription>
                )}
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
