"use client";

import { useState } from "react";
import { feedback } from "@/lib/feedback";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-fetch";

type Field =
  | { name: string; label: string; type: "text" | "email" | "number" | "date"; placeholder?: string }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; placeholder?: string }
  | { name: string; label: string; type: "textarea"; placeholder?: string };

export function SimpleForm({
  fields,
  endpoint,
  title,
  submitLabel = "Save",
  extraPayload,
  successGuidance,
}: {
  fields: Field[];
  endpoint: string;
  title: string;
  submitLabel?: string;
  extraPayload?: Record<string, unknown>;
  successGuidance?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  const initialValues = Object.fromEntries(
    fields.map((field) => [field.name, field.type === "select" ? field.options[0]?.value ?? "" : ""]),
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  async function onSubmit() {
    setShowGuidance(false);
    setLoading(true);
    const payload: Record<string, unknown> = { ...Object.fromEntries(Object.entries(values)) };
    for (const field of fields) {
      if (field.type === "number") {
        payload[field.name] = Number(payload[field.name]);
      }
    }
    const body = { ...payload, ...extraPayload };

    try {
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        feedback.success({ title: `${title} saved successfully` });
        setValues(initialValues);
        setShowGuidance(true);
      } else {
        feedback.error(result.error?.message ?? "Failed to save");
      }
    } catch {
      feedback.error("Network request failed. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
        >
          {fields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name}>{field.label}</Label>
              {field.type === "select" ? (
                <Select
                  name={field.name}
                  id={field.name}
                  value={values[field.name] ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                >
                  <option value="">{field.placeholder ?? "Select..."}</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              ) : field.type === "textarea" ? (
                <Textarea
                  name={field.name}
                  id={field.name}
                  placeholder={field.placeholder}
                  value={values[field.name] ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                />
              ) : (
                <Input
                  type={field.type}
                  name={field.name}
                  id={field.name}
                  placeholder={field.placeholder}
                  value={values[field.name] ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                />
              )}
            </div>
          ))}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving..." : submitLabel}
          </Button>
        </form>
        {showGuidance && successGuidance && (
          <div className="mt-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-secondary)] p-3 text-sm text-[var(--text-secondary)]">
            {successGuidance}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
