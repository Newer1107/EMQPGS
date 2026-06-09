"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-fetch";

type Field =
  | { name: string; label: string; type: "text" | "email" | "number" | "date" }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[] }
  | { name: string; label: string; type: "textarea" };

export function SimpleForm({ fields, endpoint, title, transform }: { fields: Field[]; endpoint: string; title: string; transform?: (payload: Record<string, FormDataEntryValue>) => unknown }) {
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(formData: FormData) {
    setLoading(true);
    setStatus(null);

    const payload = Object.fromEntries(formData.entries());
    const body = transform ? transform(payload) : payload;

    const response = await apiFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    setLoading(false);

    if (result.success) {
      setStatus({ type: "success", message: `${title} saved successfully` });
      document.querySelector("form")?.closest<HTMLFormElement>("form")?.reset();
    } else {
      setStatus({ type: "error", message: result.error?.message ?? "Failed to save" });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" action={async (formData) => onSubmit(formData)}>
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
          {status && (
            <div className={`rounded-lg border px-3 py-2 text-sm ${
              status.type === "success"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}>
              {status.message}
            </div>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving..." : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
