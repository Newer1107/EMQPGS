"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { SlotGrid, SlotDetailPanel, CoverageStats, type SlotItem } from "@/components/dashboard/slot-grid";

export function BankSlotsView({ subjectName, subjectCode, batchName, semesterNumber, academicYearCode, totalSlots, modules, marksOptions, slots }: {
  subjectName: string; subjectCode: string; batchName: string; semesterNumber: number; academicYearCode: string;
  totalSlots: number; modules: number[]; marksOptions: number[]; slots: SlotItem[];
}) {
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);

  const filledCount = slots.filter((s) => s.assignedQuestion).length;
  const emptyCount = totalSlots - filledCount;

  function handleSlotClick(slot: SlotItem) {
    const key = `${slot.moduleNumber}-${slot.marks}-${slot.slotNumber}`;
    const selectedKey = selectedSlot ? `${selectedSlot.moduleNumber}-${selectedSlot.marks}-${selectedSlot.slotNumber}` : null;
    setSelectedSlot(selectedKey === key ? null : slot);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${subjectName} — Slots`}
        description={`${subjectCode} · ${batchName} · Sem ${semesterNumber} · ${academicYearCode} · ${filledCount}/${totalSlots} filled`}
      />

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Total Slots</p>
          <p className="mt-1 text-xl font-bold">{totalSlots}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Filled</p>
          <p className="mt-1 text-xl font-bold text-green-600">{filledCount}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Empty</p>
          <p className={`mt-1 text-xl font-bold ${emptyCount > 0 ? "text-red-600" : ""}`}>{emptyCount}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Fill Rate</p>
          <p className="mt-1 text-xl font-bold">{totalSlots > 0 ? Math.round((filledCount / totalSlots) * 100) : 0}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <SlotGrid
            slots={slots}
            modules={modules}
            marksOptions={marksOptions}
            selectedSlotId={selectedSlot ? `${selectedSlot.moduleNumber}-${selectedSlot.marks}-${selectedSlot.slotNumber}` : null}
            onSlotClick={handleSlotClick}
            title="Slot Grid"
          />
          {selectedSlot && <SlotDetailPanel slot={selectedSlot} />}
        </div>
        <div className="space-y-6">
          <CoverageStats slots={slots} totalSlots={totalSlots} />
        </div>
      </div>
    </div>
  );
}
