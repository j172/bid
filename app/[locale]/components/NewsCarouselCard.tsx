"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

// Homepage carousel card (issue #56) — replaces the static "現正競標/熱門
// 競標正在進行" promo card (app/[locale]/page.tsx, the lg:col-span-2 card)
// with a rotating showcase of the latest 最新訊息 posts. Rotates every 5s
// via setInterval, same mechanism as
// app/[locale]/components/PigeonShowcaseCarouselCard.tsx; falls back to the
// original static marketing copy (fallbackBadge/Title/Desc/Cta) when there
// are currently zero news_posts rows, rather than rendering an empty card.
//
// Unlike PigeonShowcaseCarouselCard, the badge text differs between the two
// branches (activeBadge vs fallbackBadge) instead of being shared — the
// fallback branch needs to reproduce the *original* card copy verbatim
// (issue #56: "0 筆時 fallback 顯示原本的靜態行銷文案"), which includes its
// own badge, not a news-flavored one.
export interface NewsCarouselItem {
  id: number;
  title: string;
  excerpt: string;
}

const ROTATE_INTERVAL_MS = 5000;

export default function NewsCarouselCard({
  items,
  activeBadge,
  ctaLabel,
  fallbackBadge,
  fallbackTitle,
  fallbackDesc,
  fallbackCtaLabel,
  fallbackCtaHref,
}: {
  items: NewsCarouselItem[];
  activeBadge: string;
  ctaLabel: string;
  fallbackBadge: string;
  fallbackTitle: string;
  fallbackDesc: string;
  fallbackCtaLabel: string;
  fallbackCtaHref: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % items.length), ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [items.length]);

  const wrapperClass = "flex h-full flex-col justify-center rounded-2xl bg-gradient-to-r from-muted-olive-500 to-muted-olive-600 p-7 text-white";

  if (items.length === 0) {
    return (
      <div className={wrapperClass}>
        <p className="text-xs font-bold uppercase tracking-wider">{fallbackBadge}</p>
        <h3 className="mt-2 text-3xl font-black">{fallbackTitle}</h3>
        <p className="mt-3 max-w-xl text-sm text-muted-olive-100">{fallbackDesc}</p>
        <Link href={fallbackCtaHref} className="mt-5 inline-flex w-fit rounded-md bg-white px-4 py-2 text-sm font-bold text-muted-olive-700">
          {fallbackCtaLabel}
        </Link>
      </div>
    );
  }

  const current = items[index];

  return (
    <div className={wrapperClass}>
      <p className="text-xs font-bold uppercase tracking-wider">{activeBadge}</p>
      <h3 className="mt-2 truncate text-3xl font-black">{current.title}</h3>
      <p className="mt-3 max-w-xl text-sm text-muted-olive-100">{current.excerpt}</p>
      <Link href={`/news/${current.id}`} className="mt-5 inline-flex w-fit rounded-md bg-white px-4 py-2 text-sm font-bold text-muted-olive-700">
        {ctaLabel}
      </Link>
    </div>
  );
}
