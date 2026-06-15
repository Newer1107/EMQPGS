"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client-fetch";

export function UserActions({ userId, status }: { userId: string; status: string }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleDisable() {
    if (!confirm("Disable this user? They will not be able to log in.")) return;
    setLoading("disable");
    try {
      const response = await apiFetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("User disabled");
        setTimeout(() => window.location.reload(), 800);
      } else {
        toast.error(result.error?.message ?? "Failed to disable user");
      }
    } catch {
      toast.error("Network request failed");
    } finally {
      setLoading(null);
    }
  }

  async function handleReEnable() {
    setLoading("enable");
    try {
      const response = await apiFetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: UserStatus.ACTIVE }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("User re-enabled");
        setTimeout(() => window.location.reload(), 800);
      } else {
        toast.error(result.error?.message ?? "Failed to re-enable user");
      }
    } catch {
      toast.error("Network request failed");
    } finally {
      setLoading(null);
    }
  }

  if (status === "DISABLED") {
    return (
      <Button variant="outline" size="sm" disabled={loading === "enable"} onClick={handleReEnable}>
        {loading === "enable" ? "Enabling..." : "Re-enable"}
      </Button>
    );
  }

  return (
    <Button variant="danger" size="sm" disabled={loading === "disable"} onClick={handleDisable}>
      {loading === "disable" ? "Disabling..." : "Disable"}
    </Button>
  );
}
