export default function ProtectedLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center border-b border-neutral-200 px-6">
        <div className="h-5 w-32 animate-pulse rounded bg-neutral-200" />
        <div className="ml-auto h-5 w-24 animate-pulse rounded bg-neutral-200" />
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-56 border-r border-neutral-200 p-4 md:block">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-4 animate-pulse rounded bg-neutral-200"
              />
            ))}
          </div>
        </aside>
        <main className="flex-1 p-6">
          <div className="space-y-4">
            <div className="h-8 w-64 animate-pulse rounded bg-neutral-200" />
            <div className="h-4 w-96 animate-pulse rounded bg-neutral-200" />
            <div className="mt-8 grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-lg bg-neutral-100"
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
