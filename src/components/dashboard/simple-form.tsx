"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Field =
  | { name: string; label: string; type: "text" | "email" | "number" | "date" }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[] }
  | { name: string; label: string; type: "textarea" };

export function SimpleForm({ fields, endpoint, title, transform }: { fields: Field[]; endpoint: string; title: string; transform?: (payload: Record<string, FormDataEntryValue>) => unknown }) {
  const [status, setStatus] = useState("");

  async function onSubmit(formData: FormData) {
    const payload = Object.fromEntries(formData.entries());
    const body = transform ? transform(payload) : payload;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    setStatus(result.success ? `${title} saved successfully` : result.error?.message ?? "Failed to save");
    if (result.success) window.location.reload();
  }

  return (
    <form className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" action={async (formData) => onSubmit(formData)}>
      <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
      {fields.map((field) => (
        <div key={field.name} className="space-y-2">
          <Label htmlFor={field.name}>{field.label}</Label>
          {field.type === "select" ? (
            <Select name={field.name} id={field.name}>
              <option value="">Select</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : field.type === "textarea" ? (
            <Textarea name={field.name} id={field.name} />
          ) : (
            <Input type={field.type} name={field.name} id={field.name} />
          )}
        </div>
      ))}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{status}</p>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
