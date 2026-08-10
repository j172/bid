"use client";

import { Link } from "@/i18n/navigation";
import { useRotatingIndex } from "@/lib/useRotatingIndex";

// Homepage carousel card (issue #56) — replaces the static "現正競標/熱門
// 競標正在進行" promo card (app/[locale]/(with-loading)/page.tsx, the lg:col-span-2 card)
// with a rotating showcase of the latest 最新訊息 posts. Rotates every 5s
// via setInterval, same mechanism as
// app/[locale]/components/PigeonShowcaseCarouselCard.tsx.
//
// When there are currently zero news_posts rows, this used to fall back to
// that original static marketing copy (issue #56) instead of rendering an
// empty card. Issue #71 removes that — leftover promo copy ("現正競標") had
// no relationship to this section (最新訊息) and read as stale/broken once
// the real carousel shipped. The empty branch below keeps the same layout
// slot occupied (so the surrounding grid doesn't reflow) but shows a
// neutral "尚無內容" placeholder instead.
//
// Issue #146 reworks the active layout into the site-wide showcase language:
// a full-bleed cover image with a bottom-up gradient scrim, a solid pill
// badge in the top-left corner, and the title/excerpt/meta stack overlaid on
// the bottom of the image. Colors come from the project's own brand scales in
// app/styles/design-tokens.css (baltic-blue for the dark ground,
// twilight-indigo for the badge) rather than raw Tailwind defaults.
export interface NewsCarouselItem {
  id: number;
  title: string;
  excerpt: string;
  /** Pre-resolved by the caller (app/[locale]/page.tsx) to the site placeholder when the item has no 主圖 yet (issue #70). */
  imageUrl: string;
  /**
   * Pre-formatted date label for the meta row (issue #146). The caller formats
   * `NewsPost.createdAt` with `toLocaleDateString()` — the same convention the
   * news list (app/[locale]/news/page.tsx) and the news detail sidebar
   * (app/[locale]/(no-loading)/news/[id]/page.tsx) already use — so this
   * client component never re-formats a Date and can't drift from the server
   * rendering during hydration.
   */
  createdAt: string;
}

const ROTATE_INTERVAL_MS = 5000;

export default function NewsCarouselCard({
  items,
  activeBadge,
  ctaLabel,
  emptyStateTitle,
  emptyStateDesc,
}: {
  items: NewsCarouselItem[];
  activeBadge: string;
  ctaLabel: string;
  emptyStateTitle: string;
  emptyStateDesc: string;
}) {
  const index = useRotatingIndex(items.length, ROTATE_INTERVAL_MS);

  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-slate-50 p-7 text-center">
        <p className="text-sm font-bold text-ink-light">{emptyStateTitle}</p>
        <p className="mt-2 max-w-xs text-xs text-ink-light">{emptyStateDesc}</p>
      </div>
    );
  }

  const current = items[index];
  const href = `/news/${current.id}`;

  return (
    <article className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-baltic-blue-900 shadow-xl">
      <div className="relative aspect-[16/10] w-full overflow-hidden sm:aspect-[21/10]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.imageUrl}
          alt={current.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-baltic-blue-950 via-baltic-blue-950/50 to-transparent" />
        <div className="absolute left-6 top-6">
          <span className="inline-flex items-center rounded-full bg-twilight-indigo-600 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
            {activeBadge}
          </span>
        </div>
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          <h3 className="max-w-3xl text-xl font-extrabold leading-snug tracking-tight text-white sm:text-2xl lg:text-3xl">
            <Link href={href} className="transition-opacity hover:opacity-90">
              {current.title}
            </Link>
          </h3>
          <p className="mt-2.5 line-clamp-2 max-w-2xl text-xs text-slate-300 sm:text-sm">{current.excerpt}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-2 text-xs text-slate-300">
            <span>{current.createdAt}</span>
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-baltic-blue-900 transition-colors hover:bg-twilight-indigo-600 hover:text-white"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
