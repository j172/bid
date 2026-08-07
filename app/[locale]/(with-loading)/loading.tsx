export default function LocaleHomeLoading() {
  return (
    <main className="pb-8">
      <section className="bg-header text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="h-6 w-40 animate-pulse rounded-full bg-slate-700" />
            <div className="mt-5 h-12 w-4/5 animate-pulse rounded bg-slate-700" />
            <div className="mt-3 h-12 w-2/3 animate-pulse rounded bg-slate-700" />
            <div className="mt-6 h-5 w-full animate-pulse rounded bg-slate-700" />
            <div className="mt-8 flex gap-3">
              <div className="h-11 w-40 animate-pulse rounded-md bg-slate-700" />
              <div className="h-11 w-40 animate-pulse rounded-md bg-slate-700" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
                <div className="aspect-square animate-pulse rounded-lg bg-slate-700" />
                <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-slate-700" />
                <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-slate-700" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="rounded-xl border border-border bg-white p-3 shadow-sm">
              <div className="aspect-square animate-pulse rounded-lg bg-slate-200" />
              <div className="mt-3 h-4 w-4/5 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-5 w-1/3 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
