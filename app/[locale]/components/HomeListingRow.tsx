import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import ZoomableProductImage from "./ZoomableProductImage";

// Thumbnail-beside-text row used by the homepage's "今日精選" and "定價種鴿"
// strips (issue #139 item 3). The two sections had the same link wrapper and
// the same thumbnail block pasted twice; only the text beside the thumbnail
// genuinely differs between them, so that part is left to the caller.
interface HomeListingRowProps {
  id: number;
  title: string;
  /** Pre-resolved by the caller, placeholder included. */
  imageSrc: string;
  hasPhoto: boolean;
  eager: boolean;
  /** The text block shown beside the thumbnail. */
  children: ReactNode;
}

export default function HomeListingRow({ id, title, imageSrc, hasPhoto, eager, children }: HomeListingRowProps) {
  return (
    <Link
      href={`/listings/${id}`}
      className="group flex items-center gap-3 rounded-xl border border-border bg-slate-50 p-3 transition hover:-translate-y-0.5 hover:border-interactive-primary/50 hover:bg-white"
    >
      <div className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-lg ${hasPhoto ? "bg-slate-100" : "bg-white/90"}`}>
        <ZoomableProductImage
          src={imageSrc}
          alt={title}
          eager={eager}
          fetchPriority={eager ? "high" : "auto"}
          sizes="80px"
          zoomPreset="medium"
        />
      </div>

      <div className="min-w-0">{children}</div>
    </Link>
  );
}
