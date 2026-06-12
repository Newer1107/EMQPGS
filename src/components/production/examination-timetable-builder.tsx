"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type TimetableRow = {
  id: string;
  dateDay: string;
  time: string;
  paper: string;
};

const semesterOptions = [
  "Semester I",
  "Semester II",
  "Semester III",
  "Semester IV",
  "Semester V",
  "Semester VI",
  "Semester VII",
  "Semester VIII",
] as const;

export function ExaminationTimetableBuilder() {
  const dateId = useId();
  const [nextRowId, setNextRowId] = useState(2);
  const [documentRef, setDocumentRef] = useState("TCET/EXAM/ ___ of 2026");
  const [issueDate, setIssueDate] = useState("");
  const [cycleTitle, setCycleTitle] = useState("END SEMESTER EXAMINATIONS (Regular Students) MAY 2026");
  const [branch, setBranch] = useState("Computer Engineering");
  const [semester, setSemester] = useState<(typeof semesterOptions)[number]>("Semester I");
  const [signatureBlock, setSignatureBlock] = useState("Controller of Examinations");
  const [rows, setRows] = useState<TimetableRow[]>([
    {
      id: "row-1",
      dateDay: "19/05/2026 Tuesday",
      time: "10.30 am to 12.30 pm",
      paper: "Mathematics - IV",
    },
  ]);

  function updateRow(id: string, field: keyof Omit<TimetableRow, "id">, value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        id: `row-${nextRowId}`,
        dateDay: "",
        time: "",
        paper: "",
      },
    ]);
    setNextRowId((current) => current + 1);
  }

  function deleteRow(id: string) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  }

  return (
    <section className="border border-black bg-white shadow-[10px_10px_0_0_#000]">
      <div className="border-b border-black bg-[#f2eee6] px-5 py-4 sm:px-7">
        <p className="font-mono text-xs uppercase tracking-[0.28em]">COE Document Studio</p>
        <h2 className="mt-2 text-3xl uppercase sm:text-4xl">Examination Time Table</h2>
        <p className="mt-3 max-w-3xl text-sm text-neutral-700 sm:text-base">
          Manually compose a print-ready examination sheet with strict document borders and direct cell editing.
        </p>
      </div>

      <div className="space-y-8 px-4 py-5 sm:px-7 sm:py-7">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label className="font-mono text-xs uppercase tracking-[0.22em]" htmlFor="document-ref">
              Document Ref No.
            </label>
            <Input
              id="document-ref"
              value={documentRef}
              onChange={(event) => setDocumentRef(event.target.value)}
              className="h-12 rounded-none border-black text-base shadow-[4px_4px_0_0_#000] focus-visible:border-black"
            />
          </div>

          <div className="space-y-2">
            <label className="font-mono text-xs uppercase tracking-[0.22em]" htmlFor={dateId}>
              Date
            </label>
            <Input
              id={dateId}
              type="date"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
              className="h-12 rounded-none border-black text-base shadow-[4px_4px_0_0_#000] focus-visible:border-black"
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <label className="font-mono text-xs uppercase tracking-[0.22em]" htmlFor="cycle-title">
              Examination Cycle Title
            </label>
            <Input
              id="cycle-title"
              value={cycleTitle}
              onChange={(event) => setCycleTitle(event.target.value)}
              className="h-12 rounded-none border-black text-base shadow-[4px_4px_0_0_#000] focus-visible:border-black"
            />
          </div>

          <div className="space-y-2">
            <label className="font-mono text-xs uppercase tracking-[0.22em]" htmlFor="branch">
              Branch
            </label>
            <Input
              id="branch"
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              className="h-12 rounded-none border-black text-base shadow-[4px_4px_0_0_#000] focus-visible:border-black"
            />
          </div>

          <div className="space-y-2">
            <label className="font-mono text-xs uppercase tracking-[0.22em]" htmlFor="semester">
              Semester
            </label>
            <Select
              id="semester"
              value={semester}
              onChange={(event) => setSemester(event.target.value as (typeof semesterOptions)[number])}
              className="h-12 rounded-none border-black bg-[#fff8e7] text-base font-semibold shadow-[4px_4px_0_0_#000] focus-visible:border-black"
            >
              {semesterOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto border border-black">
          <table className="min-w-full border-collapse bg-white">
            <thead>
              <tr className="bg-black text-white">
                <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.22em]">
                  Date &amp; Day
                </th>
                <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.22em]">
                  Time
                </th>
                <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.22em]">
                  Paper
                </th>
                <th className="border border-black px-4 py-3 text-left font-mono text-xs uppercase tracking-[0.22em]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className={index % 2 === 0 ? "bg-white" : "bg-[#fbf8f1]"}>
                  <td className="border border-black p-0 align-top">
                    <Input
                      aria-label={`Date and day row ${index + 1}`}
                      value={row.dateDay}
                      onChange={(event) => updateRow(row.id, "dateDay", event.target.value)}
                      placeholder="19/05/2026 Tuesday"
                      className="h-16 rounded-none border-0 px-4 text-sm shadow-none focus-visible:border-0"
                    />
                  </td>
                  <td className="border border-black p-0 align-top">
                    <Input
                      aria-label={`Time row ${index + 1}`}
                      value={row.time}
                      onChange={(event) => updateRow(row.id, "time", event.target.value)}
                      placeholder="10.30 am to 12.30 pm"
                      className="h-16 rounded-none border-0 px-4 text-sm shadow-none focus-visible:border-0"
                    />
                  </td>
                  <td className="border border-black p-0 align-top">
                    <Input
                      aria-label={`Paper row ${index + 1}`}
                      value={row.paper}
                      onChange={(event) => updateRow(row.id, "paper", event.target.value)}
                      placeholder="Mathematics - IV"
                      className="h-16 rounded-none border-0 px-4 text-sm shadow-none focus-visible:border-0"
                    />
                  </td>
                  <td className="border border-black px-3 py-3 align-middle">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => deleteRow(row.id)}
                      disabled={rows.length === 1}
                      className="w-full rounded-none border-black bg-white font-mono text-xs font-bold uppercase tracking-[0.18em] shadow-[3px_3px_0_0_#000] hover:bg-[#ffe3e3]"
                    >
                      Delete Row
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button
          type="button"
          onClick={addRow}
          className="rounded-none border border-black bg-[#ffdf65] px-5 py-3 font-mono text-sm font-bold uppercase tracking-[0.2em] text-black shadow-[6px_6px_0_0_#000] hover:bg-[#ffd53d]"
        >
          + Add Row
        </Button>

        <div className="grid gap-6 border-t border-black pt-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.22em]">Preview Summary</p>
            <div className="border border-black bg-[#faf6eb] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em]">{documentRef}</p>
              <p className="mt-3 text-xl font-semibold uppercase">{cycleTitle}</p>
              <p className="mt-2 text-sm uppercase tracking-[0.12em]">
                {branch} | {semester}
              </p>
              <p className="mt-2 text-sm text-neutral-700">{issueDate || "Select the issue date"}</p>
            </div>
          </div>

          <div className="ml-auto flex max-w-sm flex-col items-stretch justify-end gap-3">
            <label className="font-mono text-xs uppercase tracking-[0.22em]" htmlFor="signature-block">
              Signature Block
            </label>
            <Textarea
              id="signature-block"
              value={signatureBlock}
              onChange={(event) => setSignatureBlock(event.target.value)}
              className="min-h-32 rounded-none border-black text-right text-base shadow-[4px_4px_0_0_#000] focus-visible:border-black"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
