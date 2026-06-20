"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DataTableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}
