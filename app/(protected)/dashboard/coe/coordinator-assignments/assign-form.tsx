"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/client-fetch";

type Option = { value: string; label: string };

type CreateProps = {
  type: "create";
  coordinators: Option[];
  departments: Option[];
};

type DeleteProps = {
  type: "delete";
  assignmentId: string;
  label: string;
};

type Props = CreateProps | DeleteProps;

export function CoordinatorAssignmentForm(props: Props) {
  const [loading, setLoading] = useState(false);
  const [coordinatorId, setCoordinatorId] = useState("");
  const [departmentId, setDepartmentId] = useState("");

  if (props.type === "delete") {
    return (
      <Button
        variant="danger"
        size="sm"
        disabled={loading}
        onClick={async () => {
          if (!confirm("Remove this coordinator from the department?")) return;
          setLoading(true);
          try {
            const response = await apiFetch(`/api/coordinator-departments/${props.assignmentId}`, { method: "DELETE" });
            const result = await response.json();
            if (response.ok && result.success) {
              toast.success("Assignment removed");
              setTimeout(() => window.location.reload(), 800);
            } else {
              toast.error(result.error?.message ?? "Failed to remove");
            }
          } catch {
            toast.error("Network request failed");
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? "Removing..." : "Remove"}
      </Button>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!coordinatorId || !departmentId) {
      toast.error("Please select both a coordinator and a department");
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch("/api/coordinator-departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coordinatorId, departmentId }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("Coordinator assigned successfully");
        setCoordinatorId("");
        setDepartmentId("");
        setTimeout(() => window.location.reload(), 800);
      } else {
        toast.error(result.error?.message ?? "Failed to assign");
      }
    } catch {
      toast.error("Network request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="coordinatorId">Coordinator</Label>
        <Select name="coordinatorId" id="coordinatorId" value={coordinatorId} onChange={(e) => setCoordinatorId(e.target.value)}>
          <option value="">Select coordinator</option>
          {props.coordinators.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="departmentId">Department</Label>
        <Select name="departmentId" id="departmentId" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
          <option value="">Select department</option>
          {props.departments.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </Select>
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Assigning..." : "Assign Coordinator"}
      </Button>
    </form>
  );
}
