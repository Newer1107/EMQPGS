import { prisma } from "@/lib/db";
import { getCurrentUserFromCookies } from "@/lib/api-context";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ContributorCoveragePage() {
  const user = await getCurrentUserFromCookies();

  const questions = await prisma.questionLibraryItem.findMany({
    where: { createdById: user.id },
  });

  const total = questions.length;
  const approved = questions.filter((q) => q.status === "APPROVED").length;
  const pending = questions.filter((q) => q.status === "PENDING" || q.status === "REVISION_SUBMITTED").length;
  const draft = questions.filter((q) => q.status === "DRAFT").length;
  const rejected = questions.filter((q) => q.status === "REJECTED").length;
  const revisionReq = questions.filter((q) => q.status === "REVISION_REQUESTED").length;
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  const assignments = await prisma.responsibilityAssignment.findMany({
    where: { userId: user.id, responsibility: "CONTRIBUTOR", scopeType: "QUESTION_BANK", deletedAt: null },
    select: { scopeId: true },
  });

  const bankIds = assignments.map((a) => a.scopeId).filter((id): id is string => id !== null);
  const banks = bankIds.length > 0 ? await prisma.questionBank.findMany({
    where: { id: { in: bankIds } },
    include: { pattern: true, _count: { select: { slots: true } } },
  }) : [];

  const totalSlots = banks.reduce((s, b) => s + (b.pattern?.totalSlots ?? 0), 0);
  const filledSlots = banks.reduce((s, b) => s + b._count.slots, 0);
  const fillPct = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

  const moduleDist: Record<number, number> = {};
  const coDist: Record<string, number> = {};
  const bloomDist: Record<string, number> = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, L6: 0 };
  const diffDist: Record<string, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
  const marksDist: Record<number, number> = {};

  for (const q of questions) {
    moduleDist[q.moduleNumber] = (moduleDist[q.moduleNumber] ?? 0) + 1;
    if (q.coMapping) coDist[q.coMapping] = (coDist[q.coMapping] ?? 0) + 1;
    if (q.rbtLevel && bloomDist[q.rbtLevel] !== undefined) bloomDist[q.rbtLevel]++;
    if (q.difficultyLevel && diffDist[q.difficultyLevel] !== undefined) diffDist[q.difficultyLevel]++;
    marksDist[q.marks] = (marksDist[q.marks] ?? 0) + 1;
  }

  const BLoom_LABELS: Record<string, string> = { L1: "Remember", L2: "Understand", L3: "Apply", L4: "Analyze", L5: "Evaluate", L6: "Create" };
  const DIFF_LABELS: Record<string, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };

  return (
    <div className="space-y-6">
      <PageHeader title="My Contribution" description="Personal question contribution and coverage overview." />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total Questions" value={total} />
        <SummaryCard label="Approved" value={approved} sub={`${approvalRate}%`} />
        <SummaryCard label="Pending Review" value={pending} />
        <SummaryCard label="Bank Fill Rate" value={`${fillPct}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Module Distribution */}
        <Card>
          <CardHeader><CardTitle>Module Contribution</CardTitle></CardHeader>
          <CardContent>
            {renderBarChart(Object.entries(moduleDist).sort(([a], [b]) => Number(a) - Number(b)).map(([k, v]) => ({ label: `M${k}`, value: v, pct: total > 0 ? Math.round((v / total) * 100) : 0 })))}
          </CardContent>
        </Card>

        {/* CO Coverage */}
        <Card>
          <CardHeader><CardTitle>Course Outcome Coverage</CardTitle></CardHeader>
          <CardContent>
            {renderBarChart(Object.entries(coDist).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ label: k, value: v, pct: total > 0 ? Math.round((v / total) * 100) : 0 })))}
          </CardContent>
        </Card>

        {/* Bloom Distribution */}
        <Card>
          <CardHeader><CardTitle>Bloom's Taxonomy</CardTitle></CardHeader>
          <CardContent>
            {renderBarChart(Object.entries(bloomDist).map(([k, v]) => ({ label: BLoom_LABELS[k] ?? k, value: v, pct: total > 0 ? Math.round((v / total) * 100) : 0 })))}
          </CardContent>
        </Card>

        {/* Difficulty Distribution */}
        <Card>
          <CardHeader><CardTitle>Difficulty Distribution</CardTitle></CardHeader>
          <CardContent>
            {renderBarChart(Object.entries(diffDist).map(([k, v]) => ({ label: DIFF_LABELS[k] ?? k, value: v, pct: total > 0 ? Math.round((v / total) * 100) : 0 })))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="py-4 text-center">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">{label}</p>
        {sub && <p className="text-xs font-medium text-[var(--accent)]">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function renderBarChart(data: { label: string; value: number; pct: number }[]) {
  if (data.length === 0) return <p className="text-sm text-[var(--text-tertiary)]">No data available.</p>;
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3 text-sm">
          <span className="w-20 shrink-0 text-right font-medium">{d.label}</span>
          <div className="flex-1">
            <div className="h-5 overflow-hidden rounded-md bg-[var(--surface-hover)]">
              <div className="flex h-full items-center justify-end rounded-md bg-[var(--accent)] px-1.5 text-[10px] font-medium text-white transition-all" style={{ width: `${d.pct}%` }}>
                {d.pct > 15 ? `${d.pct}%` : null}
              </div>
            </div>
          </div>
          <span className="w-10 text-right font-mono text-xs text-[var(--text-tertiary)]">{d.value}</span>
        </div>
      ))}
    </div>
  );
}
