"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client-fetch";

type ActionButtonProps = {
  method?: "POST" | "PATCH" | "DELETE";
  endpoint: string;
  label: string;
  confirmMessage?: string;
  successMessage?: string;
  variant?: "default" | "secondary" | "outline" | "ghost" | "danger";
  size?: "default" | "sm" | "lg";
  body?: unknown;
  onSuccess?: () => void;
  disabled?: boolean;
};

export function ActionButton({
  method = "POST",
  endpoint,
  label,
  confirmMessage,
  successMessage,
  variant = "default",
  size = "sm",
  body,
  onSuccess,
  disabled,
}: ActionButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (confirmMessage && !confirm(confirmMessage)) return;
    setLoading(true);
    try {
      const response = await apiFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success(successMessage ?? `${label} completed`);
        onSuccess?.();
      } else {
        toast.error(result.error?.message ?? "Action failed");
      }
    } catch {
      toast.error("Network request failed. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant={variant} size={size} onClick={handleClick} disabled={loading || disabled}>
      {loading ? "Processing..." : label}
    </Button>
  );
}
