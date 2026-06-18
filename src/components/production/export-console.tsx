"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/client-fetch";
import type { CoeOverviewItem } from "@/modules/production/export.service";

export function ExportConsole({ banks }: { banks: CoeOverviewItem[] }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function createExport(formData: FormData) {
    setBusy(true);
    setMessage("");
    try {
      const response = await apiFetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionBankId: formData.get("questionBankId"),
          format: formData.get("format"),
          examDate: formData.get("examDate"),
          duration: formData.get("duration"),
          maximumMarks: Number(formData.get("maximumMarks")),
          institutionName: formData.get("institutionName"),
          instructions: String(formData.get("instructions") ?? "")
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const result = await response.json();
      setMessage(result.success ? "Export generated successfully." : result.error?.message ?? "Unable to generate export");
      if (result.success) window.location.reload();
    } catch {
      setMessage("Network request failed. Please check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadExport(exportId: string) {
    try {
      const response = await apiFetch(`/api/exports/${exportId}/download`);
      const result = await response.json();
      if (result.success) {
        window.open(result.data.downloadUrl, "_blank", "noopener,noreferrer");
        return;
      }
      setMessage(result.error?.message ?? "Unable to download export");
    } catch {
      setMessage("Network request failed. Please check your connection.");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <p className="page-kicker">COE Export</p>
          <CardTitle className="mt-2 text-4xl">Generate Final Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 xl:grid-cols-3" action={async (formData) => createExport(formData)}>
            <div className="space-y-2">
              <Label htmlFor="questionBankId">Question Bank</Label>
              <Select id="questionBankId" name="questionBankId">
                {banks.filter((bank) => bank.deanReview).map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.subject.subjectCode} · {bank.examCycle.batchSemester.academicYear.code} · {bank.examCycle.examType}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="format">Format</Label>
              <Select id="format" name="format" defaultValue="PDF">
                <option value="PDF">PDF</option>
                <option value="DOCX">DOCX</option>
                <option value="ZIP">ZIP</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="institutionName">Institution Name</Label>
              <Input id="institutionName" name="institutionName" defaultValue="EMQPGS Institution" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="examDate">Exam Date</Label>
              <Input id="examDate" name="examDate" type="date" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Input id="duration" name="duration" placeholder="3 Hours" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maximumMarks">Maximum Marks</Label>
              <Input id="maximumMarks" name="maximumMarks" type="number" defaultValue={100} />
            </div>
            <div className="space-y-2 xl:col-span-3">
              <Label htmlFor="instructions">Instructions (one per line)</Label>
              <Textarea id="instructions" name="instructions" defaultValue={"Answer all questions.\nDraw neat diagrams wherever necessary.\nAssume suitable data if required."} />
            </div>
            <div className="xl:col-span-3 flex items-center justify-between gap-3">
              <p className="text-sm italic text-[var(--muted-foreground)]">{message}</p>
              <Button type="submit" disabled={busy}>Generate Export</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="page-kicker">Artifacts</p>
          <CardTitle className="mt-2 text-4xl">Recent Exports</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Subject</TH>
                <TH>Format</TH>
                <TH>Status</TH>
                <TH>Expires</TH>
                <TH>Actions</TH>
              </TR>
            </THead>
            <TBody>
              {banks.flatMap((bank) =>
                bank.exportArtifacts.map((artifact) => (
                  <TR key={artifact.id}>
                    <TD>{bank.subject.subjectCode}</TD>
                    <TD>{artifact.format}</TD>
                    <TD><Badge>{artifact.status}</Badge></TD>
                    <TD>{new Date(artifact.expiresAt).toLocaleDateString()}</TD>
                    <TD>
                      {artifact.fileAssetId ? (
                        <div className="flex gap-2">
                          <Button size="sm" type="button" onClick={() => downloadExport(artifact.id)}>Download</Button>
                          {artifact.format === "PDF" ? <Button size="sm" variant="outline" type="button" onClick={() => downloadExport(artifact.id)}>Print</Button> : null}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--muted-foreground)]">Pending</span>
                      )}
                    </TD>
                  </TR>
                )),
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
