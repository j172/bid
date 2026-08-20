"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import CarouselControls from "./CarouselControls";
import { useRotatingIndex } from "@/lib/useRotatingIndex";

// Homepage carousel card for 名家專區 (issue #176) — replaces issue #168's
// static card-grid homepage section (a plain image+title+bio grid linking
// straight to /listings?loft=<id>) with a rotating showcase of the latest
// featured_loft_posts articles, clicking through to each post's own detail
// page instead. This is a close copy of NewsCarouselCard.tsx (same visual
// language: white card, badge above a letterboxed image, title/excerpt/meta
// below in normal flow, 5s auto-rotate via useRotatingIndex) — the one
// addition is a viewMoreHref/viewMoreLabel pair, PigeonShowcaseCarouselCard-
// style, since (unlike 最新訊息, which only ever lived on the homepage before
// this) 名家專區 needs its own link to the new /featured-lofts list page.
export interface FeaturedLoftCarouselItem {
  id: number;
  title: string;
  excerpt: string;
  /** Pre-resolved by the caller to the site placeholder when the item has no 主圖 yet. */
  imageUrl: string;
  /**
   * Pre-formatted date label for the meta row — the caller formats
   * FeaturedLoftPost.createdAt with `toLocaleDateString()`, the same
   * convention NewsCarouselCard's `createdAt` prop uses, so this client
   * component never re-formats a Date and can't drift from the server
   * rendering during hydration.
   */
  createdAt: string;
}

const ROTATE_INTERVAL_MS = 5000;

export default function FeaturedLoftCarouselCard({
  items,
  activeBadge,
  ctaLabel,
  viewMoreLabel,
  viewMoreHref,
  emptyStateTitle,
  emptyStateDesc,
}: {
  items: FeaturedLoftCarouselItem[];
  activeBadge: string;
  ctaLabel: string;
  viewMoreLabel: string;
  viewMoreHref: string;
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
  const href = `/featured-lofts/${current.id}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="inline-flex items-center rounded-full bg-twilight-indigo-600 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
          {activeBadge}
        </span>
        <Link href={viewMoreHref} className="text-xs font-bold text-interactive-primary hover:underline">
          {viewMoreLabel}
        </Link>
      </div>
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.imageUrl}
          alt={current.title}
          className="absolute inset-0 h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </div>
      {/* Manual dot/arrow controls — same shared component/behaviour as
          NewsCarouselCard's own (a white card, so the dark "solid" variant
          stays legible): clicking either just calls the shared rotating
          index's setter; the 5s auto-advance timer in useRotatingIndex keeps
          running regardless. */}
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
