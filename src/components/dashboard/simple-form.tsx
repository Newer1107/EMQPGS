"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setValues(
      Object.fromEntries(
        fields.map((field) => [field.name, field.type === "select" ? field.options[0]?.value ?? "" : ""]),
      ),
    );
  }, [fields]);

  async function onSubmit() {
    setLoading(true);
    const payload = Object.fromEntries(Object.entries(values));
    const body = transform ? transform(payload) : payload;

    const response = await apiFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    setLoading(false);

    if (result.success) {
      toast.success(`${title} saved successfully`);
      setValues(
        Object.fromEntries(
          fields.map((field) => [field.name, field.type === "select" ? field.options[0]?.value ?? "" : ""]),
        ),
      );
    } else {
      toast.error(result.error?.message ?? "Failed to save");
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
                  <option value="">Select</option>
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
                  value={values[field.name] ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                />
              ) : (
                <Input
                  type={field.type}
                  name={field.name}
                  id={field.name}
                  value={values[field.name] ?? ""}
                  onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                />
              )}
            </div>
          ))}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Saving..." : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
