import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="group hover:bg-[var(--foreground)] hover:text-[var(--background)]">
      <CardHeader className="pb-3">
        <CardTitle className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)] group-hover:text-[var(--background)]">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-5xl leading-none tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}
