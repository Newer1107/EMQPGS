import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMonitoringData } from "@/lib/server-data";

export default async function CoeMonitoringPage() {
  const data = await getMonitoringData();

  return (
    <div className="space-y-8">
      <div className="section-frame">
        <p className="page-kicker">COE</p>
        <h1 className="page-display mt-4">OBSERVABILITY</h1>
        <p className="page-lead mt-6">Track platform health, active document workflows, storage inventory, and backup readiness.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Health Checks</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Database: {data.health.database.ok ? "Healthy" : "Down"} ({data.health.database.latencyMs} ms)</p>
            <p>MinIO: {data.health.minio.ok ? "Healthy" : "Down"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Platform Metrics</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Users: {data.metrics.users}</p>
            <p>Question Banks: {data.metrics.questionBanks}</p>
            <p>AI Reports: {data.metrics.aiReports}</p>
            <p>Exports: {data.metrics.exports}</p>
            <p>Backups: {data.metrics.backups}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Workflow Activity</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>AI Reports In Progress: {data.workflows.aiReportsInProgress}</p>
            <p>Paper Generations In Progress: {data.workflows.paperGenerationsInProgress}</p>
            <p>Exports In Progress: {data.workflows.exportsInProgress}</p>
            <p>Backups In Progress: {data.workflows.backupsInProgress}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
