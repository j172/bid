import LiveListingStatus from "../listings/[id]/LiveListingStatus";

// THROWAWAY visual-verification route — not part of the app, delete after use.
export default function DevPreviewHeroCountdown() {
  const now = Date.now();
  const twoDaysThreeHours = new Date(now + (2 * 24 + 3) * 3600_000 + 12 * 60_000 + 47_000).toISOString();
  const fortyMinutes = new Date(now + 40 * 60_000 + 5_000).toISOString();
  const startsInOneHour = new Date(now + 65 * 60_000).toISOString();

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10">
      <div>
        <h2 className="mb-2 text-sm font-bold text-ink-light">1. Open auction (distance-to-end)</h2>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <LiveListingStatus
            listingId={999901}
            initialCurrentPrice={101000}
            initialEndsAt={twoDaysThreeHours}
            initialStartsAt={null}
            initialStatus="open"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold text-ink-light">2. Open auction (near end)</h2>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <LiveListingStatus
            listingId={999902}
            initialCurrentPrice={2500}
            initialEndsAt={fortyMinutes}
            initialStartsAt={null}
            initialStatus="open"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-bold text-ink-light">3. Scheduled auction (distance-to-start)</h2>
        <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
          <LiveListingStatus
            listingId={999903}
            initialCurrentPrice={500}
            initialEndsAt={twoDaysThreeHours}
            initialStartsAt={startsInOneHour}
            initialStatus="scheduled"
          />
        </div>
      </div>
    </main>
  );
}
