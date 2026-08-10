import { Link } from "@/i18n/navigation";

// Card grid shared by the 最新訊息 and 入賞鴿/進口鴿 list pages (issue #139
// item 8) — the two had the same image-on-top card, the same empty state and
// the same grid, differing only in which line of metadata sits with the
// title: news shows a published date above it, pigeon-showcase shows the
// loft as a pill below it.
export interface ContentCardItem {
  id: number;
  href: string;
  /** Caller resolves the placeholder for items with no 主圖 yet. */
  imageUrl: string;
  title: string;
  /** News: published date, rendered above the title. */
  dateLabel?: string;
  /** Pigeon showcase: 合作鴿舍 name, rendered as a pill below the title. */
  badgeLabel?: string;
  excerpt: string;
}

interface ContentCardGridProps {
  items: ContentCardItem[];
  emptyLabel: string;
  viewDetailsLabel: string;
}

export default function ContentCardGrid({ items, emptyLabel, viewDetailsLabel }: ContentCardGridProps) {
  if (items.length === 0) {
    return <p className="mt-10 text-ink-light">{emptyLabel}</p>;
  }

  return (
    <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="group flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt={item.title} className="h-40 w-full object-cover" />
          <div className="flex flex-1 flex-col p-5">
            {item.dateLabel && <p className="text-xs font-semibold text-ink-light">{item.dateLabel}</p>}
            <h2 className={`${item.dateLabel ? "mt-1 " : ""}truncate text-lg font-bold text-ink`}>{item.title}</h2>
            {item.badgeLabel && (
              <p className="mt-1 inline-flex w-fit rounded-full bg-interactive-primary-subtle px-2 py-0.5 text-xs font-semibold text-interactive-primary">
                {item.badgeLabel}
              </p>
            )}
            <p className="mt-3 line-clamp-3 text-sm text-ink-light">{item.excerpt}</p>
            <span className="mt-4 text-xs font-bold text-interactive-primary group-hover:underline">
              {viewDetailsLabel}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
