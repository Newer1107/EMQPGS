import { createHash } from "node:crypto";
import type { Source } from "./engine";

function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
export function sourceHash(source: Source, blueprint: unknown): string {
  const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
  return createHash("sha256").update(JSON.stringify(canonical({
    source: { ...source, questions: byId(source.questions), slots: byId(source.slots), approvals: byId(source.approvals ?? []) }, blueprint,
  }))).digest("hex");
}
