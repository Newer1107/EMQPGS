"use client";

import { useState } from "react";
import { feedback } from "@/lib/feedback";
import { ResponsibilityType, UserStatus } from "@prisma/client";
import { responsibilityLabels } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { apiFetch } from "@/lib/client-fetch";

type UserData = {
  id: string;
  name: string;
  email: string;
  status: string;
  homeDepartment?: { id: string; name: string } | null;
  firstResponsibility?: string | null;
  responsibilities: string[];
};

type DepartmentOption = { id: string; name: string };

export function EditUserForm({ user, departments, onClose }: { user: UserData; departments: DepartmentOption[]; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [responsibility, setResponsibility] = useState(user.firstResponsibility ?? "");
  const [homeDepartmentId, setHomeDepartmentId] = useState(user.homeDepartment?.id ?? "");
  const [status, setStatus] = useState(user.status);
  const [password, setPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const body: Record<string, unknown> = { name, email, responsibility, homeDepartmentId: homeDepartmentId || null, status };
      if (password) body.password = password;
      const response = await apiFetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (response.ok && result.success) {
        feedback.success({ title: "User updated", description: "Changes are now reflected" });
        onClose();
        setTimeout(() => window.location.reload(), 800);
      } else {
        feedback.error(result.error?.message ?? "Could not update user");
      }
    } catch (error) {
      console.error("[EditDialog]", error);
      feedback.error("Unable to reach the server. Please check your connection.");
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
            <Label htmlFor="edit-responsibility">Responsibility</Label>
            <Select id="edit-responsibility" value={responsibility} onChange={(e) => setResponsibility(e.target.value)}>
              {Object.values(ResponsibilityType).map((r) => (
                <option key={r} value={r}>{responsibilityLabels[r] ?? r}</option>
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
            <Select id="edit-department" value={homeDepartmentId} onChange={(e) => setHomeDepartmentId(e.target.value)}>
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

