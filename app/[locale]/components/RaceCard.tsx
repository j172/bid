import type { RaceSource, RaceStatus } from "@/lib/races";
import RichTextContent from "./RichTextContent";

// One race (issue #241) — used by both the homepage "賽事資訊" section
// (compact) and the /races list page (full, with the pre-translation
// original shown underneath the translation for herbots.be rows, same UI
// convention as the news detail page's originalHeading section). loing_ma
// rows have no original* fields (never translated — already Traditional
// Chinese), so that section simply doesn't render for them.
export interface RaceCardItem {
  id: number;
  source: RaceSource;
  status: RaceStatus;
  title: string;
  originalTitle: string | null;
  content: string;
  originalContent: string | null;
  /** Pre-formatted by the caller (server-rendered, same "format once on the server" convention as the news carousel — issue #146). */
  raceDateLabel: string | null;
  imageUrl: string | null;
  sourceUrl: string;
}

const SOURCE_BADGE_CLASS: Record<RaceSource, string> = {
  loing_ma: "bg-amber-100 text-amber-700",
  herbots: "bg-sky-100 text-sky-700",
};

const STATUS_BADGE_CLASS: Record<RaceStatus, string> = {
  current: "bg-rose-600 text-white",
  future: "bg-interactive-primary-subtle text-interactive-primary",
  finished: "bg-slate-200 text-ink-light",
};

interface RaceCardLabels {
  sourceLabel: string;
  statusLabel: string;
  originalHeading: string;
  sourceLinkLabel: string;
}

interface RaceCardProps {
  item: RaceCardItem;
  labels: RaceCardLabels;
  /** Homepage variant: no original-text section, image hidden to keep the row compact. */
  compact?: boolean;
}

export default function RaceCard({ item, labels, compact = false }: RaceCardProps) {
  const showOriginal = !compact && item.source === "herbots" && item.originalTitle && item.originalContent;

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className={`rounded-full px-2 py-0.5 ${SOURCE_BADGE_CLASS[item.source]}`}>{labels.sourceLabel}</span>
        <span className={`rounded-full px-2 py-0.5 ${STATUS_BADGE_CLASS[item.status]}`}>{labels.statusLabel}</span>
        {item.raceDateLabel && <span className="text-ink-light">{item.raceDateLabel}</span>}
      </div>

      <div className={`mt-3 flex gap-4 ${compact ? "" : "sm:items-start"}`}>
        {!compact && item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-20 w-20 shrink-0 rounded-lg bg-slate-100 object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-bold text-ink">{item.title}</h3>
          <RichTextContent html={item.content} className="mt-1 text-sm leading-6 text-ink-light" />
        </div>
      </div>

      {showOriginal && (
        <section className="mt-4 border-t border-dashed border-border pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-ink-light">{labels.originalHeading}</h4>
          <p className="mt-1 text-sm font-semibold text-ink">{item.originalTitle}</p>
          <RichTextContent html={item.originalContent ?? ""} className="mt-1 text-sm leading-6 text-ink-light" />
        </section>
      )}

      <a
        href={item.sourceUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-3 self-start text-xs font-bold text-interactive-primary hover:underline"
      >
        {labels.sourceLinkLabel} →
      </a>
    </article>
  );
}
