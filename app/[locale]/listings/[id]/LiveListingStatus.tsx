"use client";

import { useTranslations } from "next-intl";
import { formatRemainingMs } from "@/lib/format";
import { useListingCountdown } from "@/lib/useListingCountdown";
import StatusBadge from "../../components/StatusBadge";

// Plain-text rendering of the three fields that can change after the page
// has already loaded (current price, remaining time, status). See
// useListingCountdown for the polling/ticking logic this shares with the
// hero countdown strip's digit-tile rendering.
export default function LiveListingStatus({
  listingId,
  initialCurrentPrice,
  initialEndsAt,
  initialStartsAt,
  initialStatus,
  renderedAt,
}: {
  listingId: number;
  initialCurrentPrice: number;
  initialEndsAt: string;
  /** ISO 8601 string, or null — set only while status is 'scheduled'. */
  initialStartsAt: string | null;
  initialStatus: string;
  /** ISO 8601 string captured once by the server component — see useListingCountdown. */
  renderedAt: string;
}) {
  const t = useTranslations("format");
  const { currentPrice, status, showingCountdownToStart, remainingMs } = useListingCountdown({
    listingId,
    initialCurrentPrice,
    initialEndsAt,
    initialStartsAt,
    initialStatus,
    renderedAt,
  });

  const remainingLabel = formatRemainingMs(
    remainingMs,
    t,
    showingCountdownToStart ? { prefixKey: "startsInPrefix", endedKey: "startingSoon" } : undefined,
  );

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-interactive-primary">{currentPrice}</span>
        <StatusBadge status={status} />
      </div>
      <p className="text-sm text-ink-light">{remainingLabel}</p>
    </div>
  );
}
