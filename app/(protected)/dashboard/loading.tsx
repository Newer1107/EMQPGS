export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-12">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
        <p className="text-sm text-neutral-500">Loading dashboard…</p>
      </div>
    </div>
  );
}
