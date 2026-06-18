"use client";

import { useMemo, type ReactNode } from "react";

export type SlotInfo = {
  moduleNumber: number;
  marks: number;
  slotNumber: number;
  filled: boolean;
};

type CellData = {
  filled: number;
  total: number;
  emptySlots: number[];
};

const MARKS = [2, 5, 10];
const MODULES = [1, 2, 3, 4, 5, 6];

function cellClass(cell: CellData | null, isSelected: boolean): string {
  if (isSelected) return "ring-2 ring-blue-500 bg-blue-50 z-10";
  if (!cell) return "text-gray-300";
  if (cell.emptySlots.length === 0) return "text-green-700 bg-green-50";
  if (cell.filled === 0) return "text-red-600 bg-red-50";
  return "text-amber-700 bg-amber-50";
}

function SelectedHint({
  selectedKey,
  cell,
}: {
  selectedKey: string;
  cell: CellData;
}) {
  const [mod, mk] = selectedKey.split("-").map(Number);
  const sl = cell.emptySlots.length;
  return (
    <p className="text-sm text-gray-600">
      Module {mod}, {mk} marks:{" "}
      <strong>
        {cell.filled} of {cell.total}
      </strong>{" "}
      slots filled
      {sl > 0 ? (
        <>
          {" "}&mdash; slot{sl > 1 ? "s" : ""} {cell.emptySlots.join(", ")}{" "}
          available
        </>
      ) : (
        <span className="text-green-600"> &mdash; all slots filled</span>
      )}
    </p>
  );
}

export function SlotDemand({
  slots,
  selectedModule,
  selectedMarks,
}: {
  slots: SlotInfo[];
  selectedModule?: string;
  selectedMarks?: string;
}): ReactNode {
  const groups = useMemo(() => {
    const map = new Map<string, CellData>();
    for (const s of slots) {
      const key = `${s.moduleNumber}-${s.marks}`;
      const entry = map.get(key) ?? { filled: 0, total: 0, emptySlots: [] };
      entry.total++;
      if (s.filled) entry.filled++;
      else entry.emptySlots.push(s.slotNumber);
      map.set(key, entry);
    }
    return map;
  }, [slots]);

  const selectedKey =
    selectedModule && selectedMarks
      ? `${selectedModule}-${selectedMarks}`
      : null;

  const selectedCell = selectedKey ? (groups.get(selectedKey) ?? null) : null;

  const recommendation = useMemo(() => {
    let best: { moduleNumber: number; marks: number; emptyCount: number } | null = null;
    for (const [key, data] of groups) {
      if (data.emptySlots.length > (best?.emptyCount ?? -1)) {
        const [m, mk] = key.split("-").map(Number);
        best = { moduleNumber: m, marks: mk, emptyCount: data.emptySlots.length };
      }
    }
    return best;
  }, [groups]);

  const recommendedKey = recommendation
    ? `${recommendation.moduleNumber}-${recommendation.marks}`
    : null;

  if (slots.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="text-sm font-medium text-gray-700">
        Slot Demand &mdash; Module &times; Marks
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left font-medium text-gray-400 pr-3 pb-1.5 w-8" />
              {MARKS.map((m) => (
                <th
                  key={m}
                  className="font-medium text-gray-400 px-2 pb-1.5 text-center w-[72px]"
                >
                  {m}mk
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((mod) => (
              <tr key={mod}>
                <td className="font-medium text-gray-400 pr-3 py-1 align-middle">
                  M{mod}
                </td>
                {MARKS.map((mk) => {
                  const key = `${mod}-${mk}`;
                  const cell = groups.get(key) ?? null;
                  const isSelected = selectedKey === key;
                  return (
                    <td
                      key={mk}
                      className={`px-2 py-1 text-center align-middle rounded relative ${cellClass(cell, isSelected)}`}
                    >
                      {cell ? `${cell.filled}/${cell.total}` : "\u2014"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell && selectedKey && (
        <SelectedHint selectedKey={selectedKey} cell={selectedCell} />
      )}

      {recommendation && selectedKey !== recommendedKey && (
        <p className="text-xs text-blue-600">
          Recommended: Module {recommendation.moduleNumber},{" "}
          {recommendation.marks} marks ({recommendation.emptyCount} empty slot
          {recommendation.emptyCount > 1 ? "s" : ""})
        </p>
      )}
    </div>
  );
}
