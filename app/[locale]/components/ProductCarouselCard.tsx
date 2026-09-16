"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import CarouselControls from "./CarouselControls";
import { useRotatingIndex } from "@/lib/useRotatingIndex";
import { formatProductPriceText } from "@/lib/productPriceText";

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
  /**
   * Plain-text excerpt of the product's HTML description (issue #295),
   * pre-truncated by the caller via lib/htmlText.ts's excerptHtml — same
   * convention as FeaturedLoftCarouselCard/NewsCarouselCard/
   * PigeonShowcaseCarouselCard's `excerpt` fields. Renders nothing (no
   * empty paragraph, no stray margin) when empty, e.g. a product with no
   * description yet.
   */
  excerpt?: string;
  /** Pre-resolved by the caller to the site placeholder when the product has no cover photo yet. */
  imageUrl: string;
}

const ROTATE_INTERVAL_MS = 5000;

export default function ProductCarouselCard({
  items,
  activeBadge,
  ctaLabel,
  viewMoreLabel,
  viewMoreHref,
  emptyStateTitle,
  emptyStateDesc,
}: {
  items: ProductCarouselItem[];
  activeBadge: string;
  ctaLabel: string;
  /** "查看更多" secondary link to the /products catalog page (issue #298) — sits next to the primary CTA, not the card header (contrast FeaturedLoftCarouselCard's corner placement). */
  viewMoreLabel: string;
  viewMoreHref: string;
  emptyStateTitle: string;
  emptyStateDesc: string;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
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
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-interactive-primary/60 hover:shadow-md">
      {/* Same "image itself is a link" convention as NewsCarouselCard /
          FeaturedLoftCarouselCard (issue #252). Badge lives inside the same
          Link as the image (matching HomeProductCard.tsx's structure). */}
      <Link href={href} className="block">
        <div className="mb-2">
          <span className="inline-flex rounded-md bg-twilight-indigo-600 px-2 py-1 text-[11px] font-bold text-white">
            {activeBadge}
          </span>
        </div>
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.imageUrl}
            alt={current.title}
            className="absolute inset-0 h-full w-full object-contain"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition group-hover:opacity-100" />
        </div>
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
        {current.title}
      </h3>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-lg font-black text-interactive-primary">{formatProductPriceText(current.priceText, locale)}</p>
      </div>
      {current.excerpt ? (
        <p className="mt-2.5 line-clamp-2 text-xs text-ink-light sm:text-sm">{current.excerpt}</p>
      ) : null}
      <div className="mt-3 flex items-center gap-2 text-[11px]">
        <Link
          href={href}
          className="block flex-1 rounded-md bg-header px-2 py-1 text-center font-semibold text-white"
        >
          {ctaLabel}
        </Link>
        <Link
          href={viewMoreHref}
          className="shrink-0 font-semibold text-interactive-primary hover:underline"
        >
          {viewMoreLabel}
        </Link>
      </div>
    </article>
  );
}
