import { Link } from "@/i18n/navigation";
import { formatProductPriceText } from "@/lib/productPriceText";

// Static (non-carousel) card for the /products catalog grid (issue #300) —
// the homepage's ProductCarouselCard.tsx rendered one `products` row at a
// time inside a rotating carousel; this renders every active product at
// once in a grid instead. Deliberately a standalone component rather than a
// shared abstraction with ProductCarouselCard: the two only share the
// image/title/price/excerpt/CTA *markup* (copied here verbatim), not any
// behaviour worth factoring out, and ProductCarouselCard's own file header
// notes it's already a close copy of two other carousel cards — a fourth
// near-duplicate is simpler than a forced shared base for a visual, not
// behavioural, similarity.
//
// No badge here (unlike ProductCarouselCard's "精選商品") — that label
// means "featured", which doesn't fit every row in a full catalog listing;
// omitting it avoids inventing new catalog-specific copy for a
// deliberately minimal page (issue #300 spec: no filtering/search/sort).
export interface ProductGridItem {
  id: number;
  title: string;
  /** Free display text (e.g. "NT$12,000"), never parsed as a number — see lib/products.ts's Product.priceText. */
  priceText: string;
  /** Plain-text excerpt of the product's HTML description, pre-truncated by the caller via lib/htmlText.ts's excerptHtml (same 30-char convention as the homepage carousel, issue #295). */
  excerpt?: string;
  /** Pre-resolved by the caller to the site placeholder when the product has no cover photo yet. */
  imageUrl: string;
}

export default function ProductGridCard({
  item,
  locale,
  ctaLabel,
}: {
  item: ProductGridItem;
  locale: string;
  ctaLabel: string;
}) {
  const href = `/products/${item.id}`;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-interactive-primary/60 hover:shadow-md">
      <Link href={href} className="block">
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.imageUrl}
            alt={item.title}
            className="absolute inset-0 h-full w-full object-contain"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition group-hover:opacity-100" />
        </div>
      </Link>
      <h3 className="mt-3 line-clamp-2 text-xl font-extrabold leading-snug tracking-tight text-ink sm:text-2xl">
        {item.title}
      </h3>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-lg font-black text-interactive-primary">{formatProductPriceText(item.priceText, locale)}</p>
      </div>
      {item.excerpt ? (
        <p className="mt-2.5 line-clamp-2 text-xs text-ink-light sm:text-sm">{item.excerpt}</p>
      ) : null}
      <div className="mt-3 text-[11px]">
        <Link href={href} className="block w-full rounded-md bg-header px-2 py-1 text-center font-semibold text-white">
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}
