import { PageHeader } from "@/components/dashboard/page-header";

export default function MySubjectsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="My Subjects"
        description="View subjects assigned to you for question contribution."
      />
      <p className="text-sm text-[var(--text-tertiary)]">Subject assignments will appear here.</p>
    </div>
  );
}
