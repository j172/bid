export interface CountdownTile {
  value: number;
  /** Doubles as the React key — the four unit labels are distinct within a strip. */
  label: string;
}

// Digit-tile countdown strip, shared by the listing detail page's
// HeroCountdownStrip and the homepage hero's EndTimeCountdown (issue #139
// item 9). Both had grown their own copy of the same zero-padded tile row.
//
// Two sizes rather than one: the detail page's hero strip is a standalone
// card with room to breathe, while the homepage's sits inside a three-up
// stat row and has to be tighter. The tokens differ only in scale — the
// markup and the padStart(2, "0") formatting are shared.
type TileSize = "sm" | "lg";

const CONTAINER_CLASS: Record<TileSize, string> = {
  lg: "mt-2 flex gap-1.5",
  sm: "mt-1.5 flex gap-1",
};

const TILE_CLASS: Record<TileSize, string> = {
  lg: "flex min-w-[2.5rem] flex-1 flex-col items-center rounded-lg border border-white/10 bg-white/12 py-1.5 backdrop-blur-sm",
  sm: "flex min-w-[1.85rem] flex-1 flex-col items-center rounded-md bg-white/15 py-1",
};

const VALUE_CLASS: Record<TileSize, string> = {
  lg: "text-base font-black leading-none text-white",
  sm: "text-sm font-black leading-none text-white",
};

const LABEL_CLASS: Record<TileSize, string> = {
  lg: "mt-1 text-[9px] uppercase tracking-wide text-blue-200",
  sm: "mt-0.5 text-[8px] uppercase tracking-wide text-steel-azure-200",
};

export default function CountdownTiles({ tiles, size }: { tiles: CountdownTile[]; size: TileSize }) {
  return (
    <div className={CONTAINER_CLASS[size]}>
      {tiles.map((tile) => (
        <div key={tile.label} className={TILE_CLASS[size]}>
          <span className={VALUE_CLASS[size]}>{String(tile.value).padStart(2, "0")}</span>
          <span className={LABEL_CLASS[size]}>{tile.label}</span>
        </div>
      ))}
    </div>
  );
}
