"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

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
export interface NewsCarouselItem {
  id: number;
  title: string;
  excerpt: string;
  /** Pre-resolved by the caller (app/[locale]/page.tsx) to the site placeholder when the item has no 主圖 yet (issue #70). */
  imageUrl: string;
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
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % items.length), ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-slate-50 p-7 text-center">
        <p className="text-sm font-bold text-ink-light">{emptyStateTitle}</p>
        <p className="mt-2 max-w-xs text-xs text-ink-light">{emptyStateDesc}</p>
      </div>
    );
  }

  const current = items[index];

  return (
    <div className="flex h-full flex-col justify-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-r from-steel-azure-500 to-steel-azure-600 p-7 text-white sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase tracking-wider">{activeBadge}</p>
        <h3 className="mt-2 truncate text-3xl font-black">{current.title}</h3>
        <p className="mt-3 max-w-xl text-sm text-steel-azure-100">{current.excerpt}</p>
        <Link href={`/news/${current.id}`} className="mt-5 inline-flex w-fit rounded-md bg-white px-4 py-2 text-sm font-bold text-steel-azure-700">
          {ctaLabel}
        </Link>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={current.imageUrl} alt={current.title} className="h-32 w-32 flex-shrink-0 self-center rounded-xl object-cover sm:h-40 sm:w-40" />
    </div>
  );
}
