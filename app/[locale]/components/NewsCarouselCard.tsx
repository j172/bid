"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import CarouselControls from "./CarouselControls";
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
// Issue #146 originally reworked the active layout into the site-wide
// showcase language: a full-bleed cover image with a bottom-up gradient
// scrim, a solid pill badge in the top-left corner, and the title/excerpt/meta
// stack overlaid on the bottom of the image. Issue #148 found that this news
// photo's real aspect ratio (~1.41:1) is much narrower than the card's
// letterbox, so `object-contain` left the bottom scrim sitting on blank
// letterbox space instead of the photo — and #149 concluded the underlying
// conflict ("show the whole image, uncropped" vs. "overlay text needs a dark
// scrim for contrast") can't be tuned away. So this card now matches the
// white-card language used by the rest of the homepage grid
// (app/[locale]/components/HomeProductCard.tsx): badge above the image,
// image on a light letterbox background, and title/excerpt/meta laid out
// below the image in normal flow instead of overlaid on it. The badge still
// uses the brand twilight-indigo pill styling (not HomeProductCard's subtle
// badge) so it keeps reading as a distinct "news" tag. The two
// PigeonShowcaseCarouselCard siblings deliberately keep the old dark
// overlay style — only this card changed.
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
  const t = useTranslations("home");
  const [index, setIndex] = useRotatingIndex(items.length, ROTATE_INTERVAL_MS);

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
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-2">
        <span className="inline-flex items-center rounded-full bg-twilight-indigo-600 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
          {activeBadge}
        </span>
      </div>
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.imageUrl}
          alt={current.title}
          className="absolute inset-0 h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </div>
      {/* Manual dot/arrow controls (issue #156) — dark solid styling since
          this is a white card (Hero's white/translucent style would be
          invisible here). Clicking either just calls the shared rotating
          index's setter; the 5s auto-advance timer in useRotatingIndex
          keeps running regardless, matching HeroSection's behaviour. */}
      <CarouselControls
        itemCount={items.length}
        activeIndex={index}
        onSelect={setIndex}
        onPrev={() => setIndex((previous) => (previous - 1 + items.length) % items.length)}
        onNext={() => setIndex((previous) => (previous + 1) % items.length)}
        variant="solid"
        dotLabel={(itemIndex) => t("slideGoTo", { index: itemIndex + 1 })}
        previousLabel={t("slidePrevious")}
        nextLabel={t("slideNext")}
      />
      <h3 className="mt-3 text-xl font-extrabold leading-snug tracking-tight text-ink sm:text-2xl">
        <Link href={href} className="transition-opacity hover:opacity-80">
          {current.title}
        </Link>
      </h3>
      <p className="mt-2.5 line-clamp-2 text-xs text-ink-light sm:text-sm">{current.excerpt}</p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs text-ink-light">
        <span>{current.createdAt}</span>
        <Link
          href={href}
          className="inline-flex items-center gap-1.5 rounded-full bg-header px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-twilight-indigo-600"
        >
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}
