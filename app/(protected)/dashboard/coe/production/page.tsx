import { PageHeader } from "@/components/dashboard/page-header";
import { ExportConsole } from "@/components/production/export-console";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCoeProductionData } from "@/lib/server-data";

export default async function CoeProductionPage() {
  const banks = await getCoeProductionData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Production Control"
        description="Review generated papers, AI reports, dean selections, and export final printable exam packets."
      />

      <Card>
        <CardHeader>
          <CardTitle>Generated Papers and Dean Selections</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Subject</TH>
                <TH>AI Report</TH>
                <TH>Papers</TH>
                <TH>Dean Selection</TH>
              </TR>
            </THead>
            <TBody>
              {banks.map((bank) => (
                (() => {
                  const review = bank.deanReview as
                    | {
                        regularPaper: string;
                        supplementaryPaper: string;
                        ktPaper: string;
                      }
                    | null;

                  return (
                    <TR key={bank.id}>
                      <TD>{bank.subject.subjectCode} · {bank.subject.subjectName}</TD>
                      <TD>{bank.aiReports[0]?.status ?? "Not generated"}</TD>
                      <TD>
                        <div className="flex flex-wrap gap-2">
                          {bank.generatedPapers.map((paper) => <Badge key={paper.id}>{paper.variant}</Badge>)}
                        </div>
                      </TD>
                      <TD>
                        {review ? (
                          <div className="space-y-1 text-sm">
                            <p>Regular: {review.regularPaper}</p>
                            <p>Supplementary: {review.supplementaryPaper}</p>
                            <p>KT: {review.ktPaper}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-[var(--muted-foreground)]">Pending dean review</span>
                        )}
                      </TD>
                    </TR>
                  );
                })()
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <ExportConsole banks={banks} />
    </div>
  );
}

