export default function ListingsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="rounded-xl bg-white p-4 shadow-sm sm:p-6">
        <div className="h-3 w-36 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-8 w-56 animate-pulse rounded bg-slate-200" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px,1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-9 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          </div>
        </aside>

        <section>
          <div className="rounded-xl border border-border bg-white px-4 py-3 shadow-sm">
            <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
                <div className="aspect-square animate-pulse bg-slate-200" />
                <div className="p-4">
                  <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
                  <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded bg-slate-200" />
                  <div className="mt-3 h-5 w-1/3 animate-pulse rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
