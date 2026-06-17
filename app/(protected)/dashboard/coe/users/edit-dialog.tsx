"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Role, UserStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/client-fetch";

type UserData = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
};

type DepartmentOption = { id: string; name: string };

export function EditUserForm({ user, departments, onClose }: { user: UserData; departments: DepartmentOption[]; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [departmentId, setDepartmentId] = useState(user.departmentId ?? "");
  const [status, setStatus] = useState(user.status);
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, unknown> = { name, email, role, departmentId: departmentId || null, status };
      if (password) body.password = password;
      const response = await apiFetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("User updated");
        onClose();
        setTimeout(() => window.location.reload(), 800);
      } else {
        toast.error(result.error?.message ?? "Failed to update user");
      }
    } catch {
      toast.error("Network request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Edit User: {user.name}</h4>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-role">Role</Label>
            <Select id="edit-role" value={role} onChange={(e) => setRole(e.target.value)}>
              {Object.values(Role).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-status">Status</Label>
            <Select id="edit-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.values(UserStatus).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-department">Department</Label>
            <Select id="edit-department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-password">New Password (leave blank to keep)</Label>
            <Input id="edit-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} />
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

