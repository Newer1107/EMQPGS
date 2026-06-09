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
    <form className="editorial-surface space-y-6 border-2 border-[var(--foreground)] p-8" action={async (formData) => onSubmit(formData)}>
      <div className="section-frame">
        <p className="page-kicker">Create</p>
        <h3 className="mt-3 text-4xl">{title}</h3>
      </div>
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
      <div className="editorial-rule flex items-center justify-between gap-3 pt-6">
        <p className="text-sm italic text-[var(--muted-foreground)]">{status}</p>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}
