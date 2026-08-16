import { Link } from "@/i18n/navigation";
import ZoomableProductImage from "./ZoomableProductImage";

// The homepage's grid product card, used by both "最新上架" and "買家最愛"
// (issue #139 item 3) — those two sections had the identical ~45 lines of
// JSX pasted twice, differing only in their React key prefix and how many
// leading images load eagerly.
//
// Deliberately *not* a variant of app/[locale]/components/ProductCard.tsx,
// which the listings grid uses: that card is a different design (square
// image, hover quick-action overlay, loft label, detail lines), and folding
// the two together would have meant changing how one of the two pages looks.
// This extraction is behaviour-preserving; unifying the two card designs is
// a visual-design decision, not a refactor.
interface HomeProductCardProps {
  id: number;
  title: string;
  /** Pre-resolved by the caller, placeholder included. */
  imageSrc: string;
  hasPhoto: boolean;
  badgeLabel: string;
  statusLabel: string;
  /** "N 次出價" / "N 次購買", already pluralised by the caller. */
  countLabel: string;
  priceText: string;
  ctaLabel: string;
  eager: boolean;
}

export default function HomeProductCard({
  id,
  title,
  imageSrc,
  hasPhoto,
  badgeLabel,
  statusLabel,
  countLabel,
  priceText,
  ctaLabel,
  eager,
}: HomeProductCardProps) {
  return (
    <article className="group rounded-2xl border border-border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-interactive-primary/60 hover:shadow-md">
      <Link href={`/listings/${id}`} className="block">
        <div className="mb-2">
          <span className="inline-flex rounded-md bg-interactive-primary-subtle px-2 py-1 text-[11px] font-bold text-interactive-primary">
            {badgeLabel}
          </span>
        </div>
        <div className={`relative aspect-[4/3] overflow-hidden rounded-xl ${hasPhoto ? "bg-slate-100" : "bg-white/90"}`}>
          <ZoomableProductImage
            src={imageSrc}
            alt={title}
            eager={eager}
            fetchPriority={eager ? "high" : "auto"}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            zoomPreset="medium"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent opacity-0 transition group-hover:opacity-100" />
        </div>
      </Link>
      <h3 className="mt-3 truncate text-sm font-semibold text-ink">{title}</h3>
      <div className="mt-1 flex items-center justify-between text-[11px] text-ink-light">
        <span className="inline-flex items-center gap-1">
          <span className="text-amber-500">●</span>
          <span>{statusLabel}</span>
        </span>
        <span>{countLabel}</span>
      </div>
      <div className="mt-2 flex items-end gap-2">
        <p className="text-lg font-black text-ink">{priceText}</p>
      </div>
      <div className="mt-3 text-[11px]">
        <Link
          href={`/listings/${id}`}
          className="block w-full rounded-md bg-header px-2 py-1 text-center font-semibold text-white"
        >
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}
