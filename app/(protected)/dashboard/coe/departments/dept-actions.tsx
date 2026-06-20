"use client";

import { useState } from "react";
import { feedback } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client-fetch";

type Department = { id: string; name: string; code: string; hodName: string; isActive: boolean };

export function DeleteDepartmentButton({ department }: { department: Department }) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete department "${department.name}" (${department.code})? This action cannot be undone.`)) return;
    setLoading(true);
    try {
      const response = await apiFetch(`/api/departments/${department.id}`, { method: "DELETE" });
      const result = await response.json();
      if (response.ok && result.success) {
        feedback.success({ title: "Department deleted", description: "All associated data has been removed" });
        setTimeout(() => window.location.reload(), 800);
      } else {
        feedback.error(result.error?.message ?? "Could not delete department");
      }
    } catch (error) {
      console.error("[DeptActions]", error);
      feedback.error("Unable to reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="danger" size="sm" disabled={loading} onClick={handleDelete}>
      {loading ? "Deleting..." : "Delete"}
    </Button>
  );
}

export function EditDepartmentForm({ department, onClose }: { department: Department; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(department.name);
  const [code, setCode] = useState(department.code);
  const [hodName, setHodName] = useState(department.hodName);
  const [isActive, setIsActive] = useState(department.isActive);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await apiFetch(`/api/departments/${department.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code, hodName, isActive }),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        feedback.success({ title: "Department updated" });
        onClose();
        setTimeout(() => window.location.reload(), 800);
      } else {
        feedback.error(result.error?.message ?? "Could not update department");
      }
    } catch (error) {
      console.error("[DeptActions]", error);
      feedback.error("Unable to reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Edit Department: {department.name}</h4>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="dept-name">Name</Label>
            <Input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dept-code">Code</Label>
            <Input id="dept-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dept-hod">HOD Name</Label>
            <Input id="dept-hod" value={hodName} onChange={(e) => setHodName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dept-active">Active</Label>
            <select
              id="dept-active"
              className="flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
              value={isActive ? "true" : "false"}
              onChange={(e) => setIsActive(e.target.value === "true")}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? "Saving..." : "Save Changes"}</Button>
        </div>
      </form>
    </div>
  );
}

export function EditDepartmentButton({ department }: { department: Department }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Edit</Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg p-4" onClick={(e) => e.stopPropagation()}>
            <EditDepartmentForm department={department} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

