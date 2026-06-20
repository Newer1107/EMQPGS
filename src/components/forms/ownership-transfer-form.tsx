"use client";

import { useState } from "react";
import { feedback } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/client-fetch";
import { useRouter } from "next/navigation";

type OwnershipTransferFormProps = {
  questionId: string;
  users: Array<{ id: string; name: string; email: string }>;
  currentOwnerId: string;
};

export function OwnershipTransferForm({ questionId, users, currentOwnerId }: OwnershipTransferFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toUserId, setToUserId] = useState("");
  const [reason, setReason] = useState("");

  const availableUsers = users.filter((u) => u.id !== currentOwnerId);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await apiFetch(`/api/question-library/${questionId}/transfer-ownership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, reason: reason || undefined }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        feedback.success({ title: "Ownership transferred", description: "The new owner can now manage this resource" });
        setToUserId("");
        setReason("");
        router.refresh();
      } else {
        console.error("[OwnershipTransferForm]", result.error ?? result);
        feedback.error(result.error?.message ?? "Could not transfer ownership");
      }
    } catch (error) {
      console.error("[OwnershipTransferForm]", error);
      feedback.error("Unable to reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  if (availableUsers.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Transfer Ownership</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--text-tertiary)]">No other users available for transfer.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Ownership</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="toUserId">Transfer To</Label>
            <Select id="toUserId" value={toUserId} onChange={(e) => setToUserId(e.target.value)} required>
              <option value="">Select</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Workload redistribution" />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Transferring..." : "Transfer Ownership"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
