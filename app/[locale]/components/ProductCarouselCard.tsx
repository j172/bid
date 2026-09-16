"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import CarouselControls from "./CarouselControls";
import { useRotatingIndex } from "@/lib/useRotatingIndex";

// Homepage Hero sidebar carousel for the admin-managed `products` CMS
// (issue #278) — replaces the old `topPriceCards` static stacked list (the
// highest-priced open auctions, sourced live from `listings`) with a
// rotating showcase of `products` rows (`is_active = 1`, ordered by
// `sort_order` — see lib/products.ts's listProducts and issue #277). This is
// a close copy of FeaturedLoftCarouselCard.tsx / NewsCarouselCard.tsx (same
// visual language: white card, badge above a letterboxed image,
// title/price/CTA below in normal flow, 5s auto-rotate via
// useRotatingIndex + CarouselControls) rather than the old list's bespoke
// amber-gradient price panel — issue #278 asks for this area to feel like
// the site's other homepage carousels.
//
// Unlike topPriceCards (which vanished entirely when there were no open
// auctions — issue #278's whole complaint), this always renders something:
// the empty-state branch below when there are currently zero active
// products.
export interface ProductCarouselItem {
  id: number;
  title: string;
  /** Free display text (e.g. "NT$12,000"), never parsed as a number — see lib/products.ts's Product.priceText. */
  priceText: string;
  /** Pre-resolved by the caller to the site placeholder when the product has no cover photo yet. */
  imageUrl: string;
}

const ROTATE_INTERVAL_MS = 5000;

export default function ProductCarouselCard({
  items,
  activeBadge,
  ctaLabel,
  emptyStateTitle,
  emptyStateDesc,
}: {
  items: ProductCarouselItem[];
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
  const href = `/products/${current.id}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-sm">
      <div className="mb-2">
        <span className="inline-flex rounded-md bg-twilight-indigo-600 px-2 py-1 text-[11px] font-bold text-white">
          {activeBadge}
        </span>
      </div>
      {/* Same "image itself is a link" convention as NewsCarouselCard /
          FeaturedLoftCarouselCard (issue #252). */}
      <Link
        href={href}
        className="relative block aspect-[16/9] w-full cursor-pointer overflow-hidden rounded-xl bg-slate-100"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.imageUrl}
          alt={current.title}
          className="absolute inset-0 h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </Link>
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
      <h3 className="mt-3 line-clamp-2 text-xl font-extrabold leading-snug tracking-tight text-ink sm:text-2xl">
        <Link href={href} className="transition-opacity hover:opacity-80">
          {current.title}
        </Link>
      </h3>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-lg font-black text-interactive-primary">{current.priceText}</span>
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
