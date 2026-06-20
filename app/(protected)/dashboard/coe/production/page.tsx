import { PageHeader } from "@/components/dashboard/page-header";
import { ExportConsole } from "@/components/production/export-console";
import { getCoeProductionData } from "@/lib/server-data";
import { ProductionTableClient } from "./production-table-client";

export default async function CoeProductionPage() {
  const banks = await getCoeProductionData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Control"
        description="Review generated papers, AI reports, dean selections, and export final printable exam packets."
      />

      <ProductionTableClient banks={banks as unknown as Array<{ id: string; subject: { subjectCode: string; subjectName: string }; aiReports: Array<{ status: string }>; generatedPapers: Array<{ id: string; variant: string }>; deanReview: { regularPaper: string; supplementaryPaper: string; ktPaper: string } | null }>} />

      <ExportConsole banks={banks} />
    </div>
  );
}

