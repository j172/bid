import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

// "Breadcrumb + main article + sidebar list" layout, shared by the 最新訊息
// and 入賞鴿/進口鴿 detail pages (issue #139 item 8). Layout reference:
// NextMerce's "blog-details-with-sidebar" (issues #54 and #56).
//
// The article's own contents stay with each page — news leads with a
// published-time line, pigeon-showcase with a category tag and a loft line —
// since that is the part that genuinely differs.
export interface SidebarLink {
  id: number;
  href: string;
  primary: string;
  secondary: string;
}

interface DetailWithSidebarProps {
  /** Contents of the breadcrumb line; the wrapper's styling is supplied here. */
  breadcrumb: ReactNode;
  /** The main column's article body. */
  children: ReactNode;
  sidebarTitle: string;
  sidebarItems: SidebarLink[];
  sidebarEmptyLabel: string;
  backHref: string;
  backLabel: string;
}

export default function DetailWithSidebar({
  breadcrumb,
  children,
  sidebarTitle,
  sidebarItems,
  sidebarEmptyLabel,
  backHref,
  backLabel,
}: DetailWithSidebarProps) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-light">{breadcrumb}</p>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
        <article className="min-w-0 rounded-2xl border border-border bg-white p-6 shadow-sm sm:p-8">{children}</article>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-ink-light">{sidebarTitle}</h2>
            {sidebarItems.length === 0 ? (
              <p className="mt-3 text-sm text-ink-light">{sidebarEmptyLabel}</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {sidebarItems.map((item) => (
                  <li key={item.id}>
                    <Link href={item.href} className="block rounded-lg p-2 transition hover:bg-surface-muted">
                      <p className="truncate text-sm font-semibold text-ink">{item.primary}</p>
                      <p className="truncate text-xs text-ink-light">{item.secondary}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Link
            href={backHref}
            className="rounded-2xl border border-border bg-white p-5 text-center text-sm font-bold text-interactive-primary shadow-sm hover:bg-surface-muted"
          >
            {backLabel}
          </Link>
        </aside>
      </div>
    </main>
  );
}
