// Translator shape shared by next-intl's useTranslations (client) and
// getTranslations (server) — both return a callable matching this, so
// formatRemaining works from either side without depending on next-intl's
// own (more complex) generic types.
type Translator = (key: string, values?: Record<string, string | number>) => string;

// options lets callers reuse this for a "time until X" other than the
// ends_at countdown — see the "time until start" countdown for a 'scheduled'
// listing (LiveListingStatus.tsx), which needs its own prefix/ended wording
// but otherwise counts down identically.
export function formatRemainingMs(
  remainingMs: number,
  t: Translator,
  options?: { prefixKey?: string; endedKey?: string },
): string {
  if (remainingMs <= 0) {
    return t(options?.endedKey ?? "ended");
  }

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(t("days", { count: days }));
  if (hours > 0) parts.push(t("hours", { count: hours }));
  if (days === 0 && minutes > 0) parts.push(t("minutes", { count: minutes }));

  if (parts.length === 0) {
    return t("lessThanMinute");
  }

  const prefix = t(options?.prefixKey ?? "remainingPrefix");
  return prefix ? `${prefix} ${parts.join(" ")}` : parts.join(" ");
}

export function formatRemaining(
  target: Date,
  t: Translator,
  options?: { prefixKey?: string; endedKey?: string },
): string {
  return formatRemainingMs(new Date(target).getTime() - Date.now(), t, options);
}

// Day/hour/minute/second breakdown for digit-tile countdowns (e.g. the
// listing hero strip) — same units as formatRemainingMs but as raw numbers
// rather than a localized sentence, and includes seconds since a digit clock
// is expected to tick every second.
export function breakdownRemainingMs(remainingMs: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
  };
}

// Admin-only, hardcoded Traditional Chinese — the admin backend (app/z04urru6)
// sits outside next-intl's routing/provider tree entirely (see the i18n
// ticket that introduced app/[locale]/), so it can't call formatRemaining
// with a next-intl translator. This reproduces that exact original wording.
export function formatRemainingZhHant(endsAt: Date): string {
  const remainingMs = new Date(endsAt).getTime() - Date.now();
  if (remainingMs <= 0) {
    return "已結束";
  }

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} 天`);
  if (hours > 0) parts.push(`${hours} 小時`);
  if (days === 0 && minutes > 0) parts.push(`${minutes} 分鐘`);

  return `剩餘 ${parts.length > 0 ? parts.join(" ") : "不到 1 分鐘"}`;
}
