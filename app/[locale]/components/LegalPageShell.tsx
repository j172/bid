import type { ReactNode } from "react";

// Shared narrow-column reading layout for the static legal/help pages
// (privacy, refund, terms, faq, gdpr — issue #121). Deliberately max-w-3xl
// rather than the max-w-6xl card grids the rest of the public site uses
// (see app/[locale]/contact/page.tsx): these pages are long-form prose, and a
// narrower measure keeps line lengths readable.
interface LegalPageShellProps {
  title: string;
  intro: string;
  lastUpdated: string;
  /** Standing note that the wording is a template awaiting real data/legal
   * review, or (on the FAQ) that the answers are sample content. */
  notice: string;
  children: ReactNode;
}

export default function LegalPageShell({ title, intro, lastUpdated, notice, children }: LegalPageShellProps) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-black text-ink">{title}</h1>
        <p className="mt-2 text-sm leading-7 text-ink-light">{intro}</p>
        <p className="mt-4 text-xs text-ink-light">{lastUpdated}</p>
      </header>

      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
        {notice}
      </p>

      <div className="mt-6 rounded-xl border border-border bg-white p-6 shadow-sm">{children}</div>
    </main>
  );
}
