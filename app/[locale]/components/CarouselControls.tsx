"use client";

// Shared "dot indicators + prev/next arrow buttons" carousel control block
// (issue #162 item 7) — HeroSection, NewsCarouselCard and
// PigeonShowcaseCarouselCard each hand-rolled a nearly identical version of
// this JSX when issue #156 added it, differing only in colour/size and in
// each card's own outer layout classes.
//
// Only the markup structure and click wiring move here; every visual detail
// is still driven by `variant`, so the three cards keep their existing,
// intentionally different appearance:
//   - "solid": NewsCarouselCard's white-card look (solid header-colour dots
//     and arrow buttons).
//   - "translucentLarge": HeroSection's dark-overlay look, at its original
//     (larger) size.
//   - "translucentSmall": PigeonShowcaseCarouselCard's dark-overlay look —
//     the same colours as "translucentLarge", scaled down to fit this
//     card's smaller footprint (see that component's own comment, carried
//     over from issue #156).
//
// Folds in the `items.length > 1` guard every call site used to repeat:
// renders nothing when there's nothing to switch between.
export type CarouselControlsVariant = "solid" | "translucentLarge" | "translucentSmall";

interface VariantConfig {
  wrapperClassName: string;
  dotsRowClassName: string;
  arrowsRowClassName: string;
  dotBaseClassName: string;
  dotActiveClassName: string;
  dotInactiveClassName: string;
  arrowClassName: string;
}

const VARIANTS: Record<CarouselControlsVariant, VariantConfig> = {
  solid: {
    wrapperClassName: "mt-3 flex items-center justify-between gap-3",
    dotsRowClassName: "flex items-center gap-2",
    arrowsRowClassName: "flex items-center gap-2",
    dotBaseClassName: "h-2.5 rounded-full transition",
    dotActiveClassName: "w-8 bg-header",
    dotInactiveClassName: "w-2.5 bg-ink/20 hover:bg-ink/40",
    arrowClassName:
      "inline-flex h-8 w-8 items-center justify-center rounded-full bg-header text-sm text-white transition hover:bg-twilight-indigo-600",
  },
  translucentLarge: {
    wrapperClassName: "relative z-10 mt-6 flex flex-wrap items-center gap-3",
    dotsRowClassName: "flex items-center gap-2",
    arrowsRowClassName: "flex items-center gap-2",
    dotBaseClassName: "h-2.5 rounded-full transition",
    dotActiveClassName: "w-8 bg-white",
    dotInactiveClassName: "w-2.5 bg-white/35 hover:bg-white/60",
    arrowClassName:
      "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg text-white backdrop-blur-sm transition hover:bg-white/20",
  },
  translucentSmall: {
    wrapperClassName: "mt-3 flex items-center justify-between gap-3",
    dotsRowClassName: "flex items-center gap-1.5",
    arrowsRowClassName: "flex items-center gap-1.5",
    dotBaseClassName: "h-2 rounded-full transition",
    dotActiveClassName: "w-6 bg-white",
    dotInactiveClassName: "w-2 bg-white/35 hover:bg-white/60",
    arrowClassName:
      "inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm text-white backdrop-blur-sm transition hover:bg-white/20",
  },
};

export interface CarouselControlsProps {
  itemCount: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  variant: CarouselControlsVariant;
  /** aria-label for one dot, e.g. `(index) => t("slideGoTo", { index: index + 1 })`. */
  dotLabel: (index: number) => string;
  previousLabel: string;
  nextLabel: string;
}

export default function CarouselControls({
  itemCount,
  activeIndex,
  onSelect,
  onPrev,
  onNext,
  variant,
  dotLabel,
  previousLabel,
  nextLabel,
}: CarouselControlsProps) {
  // Nothing to switch between — same guard every call site used to repeat
  // (`items.length > 1 && (...)`) before rendering this block at all.
  if (itemCount <= 1) return null;

  const config = VARIANTS[variant];

  return (
    <div className={config.wrapperClassName}>
      <div className={config.dotsRowClassName}>
        {Array.from({ length: itemCount }, (_, index) => (
          <button
            key={index}
            type="button"
            aria-label={dotLabel(index)}
            onClick={() => onSelect(index)}
            className={`${config.dotBaseClassName} ${index === activeIndex ? config.dotActiveClassName : config.dotInactiveClassName}`}
          />
        ))}
      </div>
      <div className={config.arrowsRowClassName}>
        <button type="button" aria-label={previousLabel} onClick={onPrev} className={config.arrowClassName}>
          ←
        </button>
        <button type="button" aria-label={nextLabel} onClick={onNext} className={config.arrowClassName}>
          →
        </button>
      </div>
    </div>
  );
}
