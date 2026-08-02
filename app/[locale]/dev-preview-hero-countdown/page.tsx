import HeroCountdownStrip from "../listings/[id]/HeroCountdownStrip";
import LiveListingStatus from "../listings/[id]/LiveListingStatus";

// THROWAWAY visual-verification route — not part of the app, delete after use.
export default function DevPreviewHeroCountdown() {
  const now = Date.now();
  const renderedAt = new Date(now).toISOString();
  const twoDaysThreeHours = new Date(now + (2 * 24 + 3) * 3600_000 + 12 * 60_000 + 47_000).toISOString();
  const fortyMinutes = new Date(now + 40 * 60_000 + 5_000).toISOString();
  const startsInOneHour = new Date(now + 65 * 60_000).toISOString();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10">
      <div>
        <h2 className="mb-2 text-sm font-bold text-ink-light">1. Open auction, with buyout price (3 cards)</h2>
        <HeroCountdownStrip
          listingId={999901}
          imageUrl="/images/hero-placeholder.png"
          initialCurrentPrice={101000}
          initialBuyItNowPrice={10000000}
          initialEndsAt={twoDaysThreeHours}
          initialStartsAt={null}
          initialStatus="open"
          renderedAt={renderedAt}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold text-ink-light">2. Open auction, no buyout price (2 cards, should collapse)</h2>
        <HeroCountdownStrip
          listingId={999902}
          imageUrl="/images/hero-placeholder.png"
          initialCurrentPrice={2500}
          initialBuyItNowPrice={null}
          initialEndsAt={fortyMinutes}
          initialStartsAt={null}
          initialStatus="open"
          renderedAt={renderedAt}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold text-ink-light">3. Scheduled auction, not yet open (distance-to-start phase)</h2>
        <HeroCountdownStrip
          listingId={999903}
          imageUrl="/images/hero-placeholder.png"
          initialCurrentPrice={500}
          initialBuyItNowPrice={5000}
          initialEndsAt={twoDaysThreeHours}
          initialStartsAt={startsInOneHour}
          initialStatus="scheduled"
          renderedAt={renderedAt}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold text-ink-light">4. LiveListingStatus (plain-text version, for comparison)</h2>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <LiveListingStatus
            listingId={999901}
            initialCurrentPrice={101000}
            initialEndsAt={twoDaysThreeHours}
            initialStartsAt={null}
            initialStatus="open"
            renderedAt={renderedAt}
          />
        </div>
      </div>
    </main>
  );
}
