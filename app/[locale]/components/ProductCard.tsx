import { Link } from "@/i18n/navigation";
import ZoomableProductImage from "./ZoomableProductImage";
import { listingPhotoUrl } from "@/lib/uploads";

interface ProductCardProps {
  id: number;
  title: string;
  description: string;
  photo?: string;
  typeBadgeLabel: string;
  quickActionLabel: string;
  viewDetailsLabel: string;
  priceText: string;
  detailLines: string[];
  eager: boolean;
  highPriorityImage: boolean;
}

export default function ProductCard({
  id,
  title,
  description,
  photo,
  typeBadgeLabel,
  quickActionLabel,
  viewDetailsLabel,
  priceText,
  detailLines,
  eager,
  highPriorityImage,
}: ProductCardProps) {
  return (
    <Link
      href={`/listings/${id}`}
      className="group overflow-hidden rounded-xl border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <ZoomableProductImage
          src={photo ? listingPhotoUrl(id, photo) : "/images/hero-placeholder.png"}
          alt={title}
          eager={eager}
          fetchPriority={highPriorityImage ? "high" : "auto"}
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
          zoomPreset="low"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/0 to-transparent opacity-0 transition group-hover:opacity-100" />
        <div className="absolute bottom-3 left-1/2 w-[calc(100%-1.5rem)] -translate-x-1/2 translate-y-3 rounded-md bg-white/95 px-3 py-2 text-center text-xs font-bold text-interactive-primary opacity-0 shadow-sm transition group-hover:translate-y-0 group-hover:opacity-100">
          {quickActionLabel}
        </div>
      </div>
      <div className="p-4">
        <span className="inline-block rounded-full bg-interactive-primary-subtle px-2 py-0.5 text-xs font-medium text-interactive-primary-active">{typeBadgeLabel}</span>
        <h2 className="mt-2 truncate font-semibold">{title}</h2>
        <p className="mt-1 line-clamp-2 text-xs text-ink-light">{description}</p>
        <p className="mt-2 text-lg font-black text-interactive-primary">{priceText}</p>
        {detailLines.map((line) => (
          <p key={line} className="mt-1 text-xs text-ink-light">
            {line}
          </p>
        ))}
        <p className="mt-3 inline-flex rounded-full bg-interactive-primary-subtle px-2 py-0.5 text-xs font-semibold text-interactive-primary">{viewDetailsLabel}</p>
      </div>
    </Link>
  );
}