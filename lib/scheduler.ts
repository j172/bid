// In-process daily exchange-rate scheduler (issue #45). This site is
// self-hosted as a single long-lived Node process rather than something with
// an OS crontab available, so the daily TAIFEX sync is scheduled from inside
// the app itself via node-cron instead. Started once from instrumentation.ts
// (Next.js's supported hook for one-time server-start code — see its own
// comment for why that's the right place).
import cron from "node-cron";
import { syncExchangeRates } from "@/lib/exchangeRates";

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
}
