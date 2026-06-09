import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DataTableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <p className="page-kicker">Registry</p>
        <CardTitle className="mt-2 text-5xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
