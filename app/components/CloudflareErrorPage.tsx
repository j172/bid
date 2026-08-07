// Shared presentational shell for this site's error pages (404 / 500-class
// errors / admin 403), styled after Cloudflare's own error pages — see
// issue #65 for the reasoning: this is a deliberate, confirmed exception to
// the rest of the site's steel-azure/twilight-indigo/baltic-blue brand palette
// (see app/styles/design-tokens.css), so every color below is a literal
// Cloudflare-style hex value rather than one of those design tokens.
//
// Deliberately has no directive of its own ('use client' / 'use server')
// and touches no context/provider — it's plain props-in/JSX-out — so it can
// be rendered unchanged from:
//   - a Server Component (app/[locale]/not-found.tsx, app/z04urru6/layout.tsx)
//   - a Client Component (app/[locale]/error.tsx)
//   - app/global-error.tsx, which per Next.js's rules can't depend on any
//     layout or provider (next-intl included) since it's the fallback for
//     when the root layout itself throws.
// Every string is passed in by the caller rather than looked up here, so
// this component carries no i18n mechanism of its own either.

interface StatusItem {
  label: string;
  ok: boolean;
}

export interface CloudflareErrorPageProps {
  errorCode: string;
  heading: string;
  status: {
    browser: StatusItem;
    cloudflare: StatusItem;
    host: StatusItem;
  };
  statusOkText: string;
  statusErrorText: string;
  whatHappenedTitle: string;
  whatHappened: string;
  whatCanIDoTitle: string;
  whatCanIDo: string;
  rayIdLabel: string;
  rayId: string;
  timestampLabel: string;
  timestamp: string;
  yourIpLabel: string;
  clientIp: string | null;
  ipUnknownText: string;
  perfSecByText: string;
  homeHref?: string;
  homeLabel?: string;
  // Optional second action (e.g. error.tsx's `reset()`) rendered next to
  // "back home". Takes a plain callback rather than baking in any specific
  // navigation behavior, so this stays usable from a Server Component too
  // (not-found.tsx, the admin layout) as long as they simply don't pass it.
  retryLabel?: string;
  onRetry?: () => void;
}

function StatusColumn({ item, okText, errorText }: { item: StatusItem; okText: string; errorText: string }) {
  const color = item.ok ? "#4d8a1f" : "#bd2426";
  const dotColor = item.ok ? "#9bca3e" : "#bd2426";
  return (
    <div className="px-3 py-5 text-center sm:px-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#7a7a7a]">{item.label}</div>
      <div className="mt-2 flex items-center justify-center gap-1.5 text-sm font-medium" style={{ color }}>
        <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: dotColor }} />
        {item.ok ? okText : errorText}
      </div>
    </div>
  );
}

export default function CloudflareErrorPage({
  errorCode,
  heading,
  status,
  statusOkText,
  statusErrorText,
  whatHappenedTitle,
  whatHappened,
  whatCanIDoTitle,
  whatCanIDo,
  rayIdLabel,
  rayId,
  timestampLabel,
  timestamp,
  yourIpLabel,
  clientIp,
  ipUnknownText,
  perfSecByText,
  homeHref,
  homeLabel,
  retryLabel,
  onRetry,
}: CloudflareErrorPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f6f6f6] text-[#313131]">
      <div aria-hidden className="h-1.5 w-full bg-[#f6821f]" />
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-2xl overflow-hidden rounded-sm border border-[#dcdcdc] bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dcdcdc] px-6 py-4">
            <span className="text-lg font-extrabold tracking-tight text-[#f6821f]">CLOUDFLARE</span>
            <div className="text-right text-[11px] leading-tight text-[#8a8a8a]">
              <div>
                {rayIdLabel}: <span className="font-mono">{rayId}</span>
              </div>
              <div>
                {timestampLabel}: {timestamp}
              </div>
            </div>
          </header>

          <section className="border-b border-[#dcdcdc] px-6 py-8 text-center">
            <p className="text-sm text-[#8a8a8a]">Error {errorCode}</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#313131]">{heading}</h1>
          </section>

          <section
            aria-hidden={false}
            className="grid grid-cols-3 divide-x divide-[#dcdcdc] border-b border-[#dcdcdc] bg-[#fafafa]"
          >
            <StatusColumn item={status.browser} okText={statusOkText} errorText={statusErrorText} />
            <StatusColumn item={status.cloudflare} okText={statusOkText} errorText={statusErrorText} />
            <StatusColumn item={status.host} okText={statusOkText} errorText={statusErrorText} />
          </section>

          <section className="border-b border-[#dcdcdc] px-6 py-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#f6821f]">{whatHappenedTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#404242]">{whatHappened}</p>
          </section>

          <section className="px-6 py-6">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#f6821f]">{whatCanIDoTitle}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#404242]">{whatCanIDo}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {homeHref && homeLabel ? (
                <a
                  href={homeHref}
                  className="inline-block rounded-sm border border-[#f6821f] px-4 py-2 text-sm font-medium text-[#f6821f] transition-colors hover:bg-[#f6821f] hover:text-white"
                >
                  {homeLabel}
                </a>
              ) : null}
              {onRetry && retryLabel ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-block rounded-sm border border-[#dcdcdc] px-4 py-2 text-sm font-medium text-[#404242] transition-colors hover:bg-[#ececec]"
                >
                  {retryLabel}
                </button>
              ) : null}
            </div>
          </section>
        </div>
      </main>
      <footer className="px-4 pb-8 pt-2 text-center text-[11px] leading-relaxed text-[#9a9a9a]">
        <p>
          {rayIdLabel}: <span className="font-mono">{rayId}</span> &bull; {yourIpLabel}: {clientIp ?? ipUnknownText}
        </p>
        <p className="mt-1">{perfSecByText}</p>
      </footer>
    </div>
  );
}
