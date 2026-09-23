"use client";
import { useState } from "react";
import { blueprintSchema, EMPTY_BLUEPRINT, type Blueprint } from "@/modules/qb-audit/validation";

export function BlueprintEditor({ initial, busy, onSave }: { initial: Blueprint | null; busy: boolean; onSave: (data: Blueprint) => Promise<void> }) {
  const [value, setValue] = useState<Blueprint>(initial ?? EMPTY_BLUEPRINT);
  const [error, setError] = useState("");
  const input = "border rounded px-2 py-1 w-full bg-transparent";
  function moduleChange(index: number, change: Partial<Blueprint["table1"][number]>) {
    setValue(v => ({ ...v, table1: v.table1.map((r, i) => i === index ? { ...r, ...change } : r) }));
  }
  async function save() {
    const parsed = blueprintSchema.safeParse(value);
    if (!parsed.success) { setError(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")); return; }
    setError(""); await onSave(parsed.data);
  }
  return <fieldset disabled={busy} className="space-y-4 rounded border p-4">
    <legend className="font-semibold">Academic blueprint · Tables 1, 2 and 3</legend>
    <p>Each save creates a version. Existing audit snapshots keep their original blueprint. Percentages are based on question counts.</p>
    <label className="block">Approved syllabus reference / revision<input className={input} value={value.syllabusReference} onChange={e => setValue({ ...value, syllabusReference: e.target.value })} /></label>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="text-left font-medium">Table 1: Module–CO mapping and teaching hours</caption>
      <thead><tr>{["Module", "Module name", "COs", "Hours", ""].map((h,i) => <th key={i} className="p-2">{h}</th>)}</tr></thead>
      <tbody>{value.table1.map((m, i) => <tr key={m.module}>
        <td className="p-2">{m.module}</td>
        <td className="p-2"><input aria-label={`Module ${m.module} name`} className={input} value={m.name} onChange={e => moduleChange(i, { name: e.target.value })} /></td>
        <td className="p-2"><div className="flex flex-wrap gap-2">{(["CO1", "CO2", "CO3", "CO4", "CO5", "CO6"] as const).map(co => <label key={co}><input type="checkbox" checked={m.co.includes(co)} onChange={e => moduleChange(i, { co: e.target.checked ? [...m.co, co] : m.co.filter(c => c !== co) })} /> {co}</label>)}</div></td>
        <td className="p-2"><input aria-label={`Module ${m.module} hours`} type="number" min="0.1" step="0.1" className={input} value={m.hours} onChange={e => moduleChange(i, { hours: Number(e.target.value) })} /></td>
        <td><button type="button" className="underline" onClick={() => setValue(v => ({ ...v, table1: v.table1.filter(r => r.module !== m.module), table2: v.table2.filter(r => r.module !== m.module) }))}>Remove module {m.module}</button></td>
      </tr>)}</tbody>
    </table></div>
    <button type="button" className="rounded border px-3 py-2" onClick={() => { const moduleNumber = Math.max(0, ...value.table1.map(r => r.module)) + 1; setValue(v => ({ ...v, table1: [...v.table1, { module: moduleNumber, co: ["CO1"], name: "", hours: 1 }], table2: [...v.table2, { module: moduleNumber, theory: 50, numerical: 50 }] })); }}>Add module</button>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="text-left font-medium">Table 2: Module theory / numerical percentages (COs follow Table 1)</caption>
      <thead><tr><th>Module</th><th>Theory %</th><th>Numerical %</th></tr></thead>
      <tbody>{value.table2.map((m, i) => <tr key={m.module}><td>{m.module}</td>{(["theory", "numerical"] as const).map(key => <td key={key} className="p-2"><input aria-label={`Module ${m.module} ${key} percentage`} type="number" min="0" max="100" step="0.01" className={input} value={m[key]} onChange={e => setValue(v => ({ ...v, table2: v.table2.map((r,j) => j === i ? { ...r, [key]: Number(e.target.value) } : r) }))} /></td>)}</tr>)}</tbody>
    </table></div>
    <p className="font-medium">Table 3: Global distribution</p>
    <div className="flex gap-4">{(["theory", "numerical"] as const).map(key => <label key={key}>{key} %<input type="number" min="0" max="100" step="0.01" className={input} value={value.table3[key]} onChange={e => setValue({ ...value, table3: { ...value.table3, [key]: Number(e.target.value) } })} /></label>)}</div>
    <p>Each theory/numerical pair must total 100%. Unknown question types remain unknown.</p>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <button type="button" className="rounded border px-4 py-2 font-medium" onClick={save}>Save new blueprint version</button>
  </fieldset>;
}
