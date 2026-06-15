"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/client-fetch";
import { useRouter } from "next/navigation";

type SignedReportUploadProps = {
  questionBankId: string;
};

export function SignedReportUpload({ questionBankId }: SignedReportUploadProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    setLoading(true);
    try {
      const presignResponse = await apiFetch(`/api/question-banks/${questionBankId}/signed-report/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        }),
      });
      const presignResult = await presignResponse.json();
      if (!presignResponse.ok || !presignResult.success) {
        toast.error(presignResult.error?.message ?? "Failed to get upload URL");
        return;
      }
      const { url, fileAssetId } = presignResult.data;

      const uploadResponse = await fetch(url, {
        method: "PUT",
        body: file,
      });
      if (!uploadResponse.ok) {
        toast.error("Failed to upload file to storage");
        return;
      }

      const linkResponse = await apiFetch(`/api/question-banks/${questionBankId}/signed-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileAssetId }),
      });
      const linkResult = await linkResponse.json();
      if (linkResponse.ok && linkResult.success) {
        toast.success("Signed report uploaded");
        setFile(null);
        router.refresh();
      } else {
        toast.error(linkResult.error?.message ?? "Failed to link report");
      }
    } catch {
      toast.error("Network request failed. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Signed Report</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">Signed Report File (PDF)</Label>
            <Input id="file" type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </div>
          <Button type="submit" disabled={loading || !file} className="w-full">
            {loading ? "Uploading..." : "Upload Signed Report"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
