import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMonitoringData } from "@/lib/server-data";

export default async function CoeMonitoringPage() {
  const data = await getMonitoringData();

  return (
    <div className="space-y-8">
      <div className="section-frame">
        <p className="page-kicker">COE</p>
        <h1 className="page-display mt-4">OBSERVABILITY</h1>
        <p className="page-lead mt-6">Track platform health, queue activity, storage inventory, and backup readiness.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Health Checks</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Database: {data.health.database.ok ? "Healthy" : "Down"} ({data.health.database.latencyMs} ms)</p>
            <p>Redis: {data.health.redis.ok ? "Healthy" : "Down"}</p>
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
          <CardHeader><CardTitle>Queues</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>AI Analysis Waiting: {data.queues.aiAnalysis.waiting}</p>
            <p>Paper Generation Waiting: {data.queues.paperGeneration.waiting}</p>
            <p>Export Generation Waiting: {data.queues.exportGeneration.waiting}</p>
            <p>Cleanup Waiting: {data.queues.retentionCleanup.waiting}</p>
            <p>Backup Waiting: {data.queues.systemBackup.waiting}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
