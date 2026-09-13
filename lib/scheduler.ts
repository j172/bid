// In-process daily exchange-rate scheduler (issue #45). This site is
// self-hosted as a single long-lived Node process rather than something with
// an OS crontab available, so the daily TAIFEX sync is scheduled from inside
// the app itself via node-cron instead. Started once from instrumentation.ts
// (Next.js's supported hook for one-time server-start code — see its own
// comment for why that's the right place).
import cron from "node-cron";
import { syncExchangeRates } from "@/lib/exchangeRates";
import { syncHerbotsNews } from "@/lib/newsSync";
import { getLastRunAt, isSyncStale, type SyncJobName } from "@/lib/syncRuns";

let started = false;

// issue #81: production evidence shows this host periodically kills and
// restarts the bid-web process (~every 4.4h over a 5.5-day sample), and
// every one of the observed startup-sync failures happened right in that
// post-restart window — while the same TAIFEX endpoint, hit by hand via curl
// or a standalone `node -e "fetch(...)"` moments later, succeeded
// immediately. That points at Next.js's own cold-start CPU/memory pressure
// (module loading, compilation, etc. all happening at once right after
// register() runs) rather than a real network outage. Firing the sync
// synchronously inside register()/startScheduler() means it always lands
// squarely in that unstable window. A few seconds' delay costs nothing (the
// footer already has fallback copy for "not synced yet") and gives the
// process a moment to finish settling before its one real per-restart
// chance at a successful fetch (see TAIFEX_FETCH_MAX_ATTEMPTS's comment in
// lib/exchangeRates.ts for the other half of this mitigation).
const STARTUP_SYNC_DELAY_MS = 8000;

// issue #261: news tracks its "last completed run" timestamp
// in the sync_runs table (see lib/syncRuns.ts / db/init.sql's sync_runs
// comment). After the same STARTUP_SYNC_DELAY_MS boot delay used above, this
// module checks that timestamp and fires a one-off catch-up
// sync if it's missing or older than this many hours — so a deploy that
// happens to land after today's 08:40 Asia/Taipei tick has already passed
// doesn't leave the site without fresh news until tomorrow's tick.
//
// This deliberately does NOT sync unconditionally on every boot the way
// exchange rates' startup sync above does: issue #81's production evidence
// shows this host gets killed and restarted roughly every 4.4 hours, and
// news is comparatively heavy (many external requests, plus a
// Cloudflare Workers AI translation call per paragraph for herbots.be
// content) — an unconditional per-restart re-run would multiply that cost by
// however many times the process happens to restart in a day, for zero
// benefit once a run has already landed today.
//
// 20 hours is comfortably longer than the ~24h gap between two consecutive
// scheduled 08:40 ticks (so an ordinary day, where the cron tick already ran,
// never re-triggers a catch-up here) while still being short enough to catch
// both "deployed after today's 08:40 window already passed" and "the process
// was down across an entire scheduled tick".
const SYNC_STALENESS_THRESHOLD_HOURS = 20;

// Checks jobName's last recorded run and, if stale (see
// SYNC_STALENESS_THRESHOLD_HOURS above), fires syncFn() once — logging the
// outcome with jobName's own prefix, same "describe the result, .catch() only
// as a backstop against a truly unexpected bug" convention used by the
// cron.schedule callbacks below. Every failure here (a getLastRunAt() error,
// or syncFn() itself somehow throwing) is caught and logged rather than
// propagated: this runs from a bare setTimeout with no caller to hand a
// rejection to.
async function maybeRunCatchUpSync<T>(
  jobName: SyncJobName,
  syncFn: () => Promise<T>,
  describeResult: (result: T) => string,
): Promise<void> {
  const logPrefix = `[${jobName}Sync]`;

  let lastRunAt: Date | null;
  try {
    lastRunAt = await getLastRunAt(jobName);
  } catch (error) {
    console.error(`${logPrefix} failed to read last sync run time, skipping catch-up check`, error);
    return;
  }

  if (!isSyncStale(lastRunAt, new Date(), SYNC_STALENESS_THRESHOLD_HOURS)) {
    console.log(
      `${logPrefix} last run at ${lastRunAt?.toISOString()} is within ${SYNC_STALENESS_THRESHOLD_HOURS}h, skipping catch-up sync`,
    );
    return;
  }

  console.log(
    `${logPrefix} last run ${lastRunAt ? lastRunAt.toISOString() : "never"} is stale (>${SYNC_STALENESS_THRESHOLD_HOURS}h), firing catch-up sync`,
  );
  try {
    const result = await syncFn();
    console.log(`${logPrefix} catch-up sync done: ${describeResult(result)}`);
  } catch (error) {
    console.error(`${logPrefix} catch-up sync failed`, error);
  }
}

// Idempotent: Next.js dev mode can re-invoke instrumentation's register()
// across fast-refresh module reloads, so a module-level guard keeps this
// from registering (and firing) the cron job more than once per process.
export function startScheduler(): void {
  if (started) return;
  started = true;

  // 08:10 Asia/Taipei daily — comfortably after TAIFEX typically publishes
  // the day's rate, well before most of Taiwan's business day starts.
  cron.schedule(
    "10 8 * * *",
    () => {
      syncExchangeRates().catch((error) => {
        console.error("[exchangeRates] scheduled sync failed", error);
      });
    },
    { timezone: "Asia/Taipei" },
  );

  // Also sync once shortly after boot, so the footer/listing pages have a
  // rate to show without waiting for the next 08:10 tick — delayed rather
  // than fired synchronously here, see STARTUP_SYNC_DELAY_MS's comment.
  setTimeout(() => {
    syncExchangeRates().catch((error) => {
      console.error("[exchangeRates] startup sync failed", error);
    });
  }, STARTUP_SYNC_DELAY_MS);

  // 08:40 Asia/Taipei daily (issue #240) — offset 30 minutes after the
  // exchange-rate tick above so both scheduled jobs don't launch at exactly
  // the same instant. Unlike exchange rates, this deliberately has no
  // startup-sync counterpart: fetching, translating, and importing a batch
  // of articles is much heavier than an HTTP CSV fetch, and this
  // host's frequent restarts (see the exchange-rate STARTUP_SYNC_DELAY_MS
  // comment above) would otherwise turn "run once after every restart" into
  // a real per-restart cost. News has no "footer must show something
  // immediately" requirement the way exchange rates do, so missing a boot
  // window and simply waiting for the next scheduled tick is an acceptable
  // trade-off here. syncHerbotsNews() itself never throws for an ordinary
  // per-article/per-page failure (see lib/newsSync.ts) — this .catch() is
  // only a backstop against a truly unexpected bug.
  cron.schedule(
    "40 8 * * *",
    () => {
      syncHerbotsNews()
        .then((result) => {
          console.log(
            `[newsSync] daily sync done: imported=${result.imported} skippedExisting=${result.skippedExisting} ` +
              `skippedNoContent=${result.skippedNoContent} translationFailures=${result.translationFailures} errors=${result.errors.length}`,
          );
          for (const message of result.errors) {
            console.error(`[newsSync] ${message}`);
          }
        })
        .catch((error) => {
          console.error("[newsSync] scheduled sync failed", error);
        });
    },
    { timezone: "Asia/Taipei" },
  );

  // issue #261 post-boot catch-up checks (see SYNC_STALENESS_THRESHOLD_HOURS'
  // comment above for the full reasoning) — same STARTUP_SYNC_DELAY_MS boot
  // delay as exchange rates' startup sync, so this doesn't land in the same
  // cold-start instability window either.
  setTimeout(() => {
    // maybeRunCatchUpSync never rejects (every failure inside it is caught
    // and logged) — `void` just marks this fire-and-forget call as
    // intentional, same convention as lib/notifications.ts/
    // lib/homepageVideos.ts.
    void maybeRunCatchUpSync(
      "news",
      syncHerbotsNews,
      (result) =>
        `imported=${result.imported} skippedExisting=${result.skippedExisting} ` +
        `skippedNoContent=${result.skippedNoContent} translationFailures=${result.translationFailures} errors=${result.errors.length}`,
    );
  }, STARTUP_SYNC_DELAY_MS);
}
