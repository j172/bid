// In-process daily exchange-rate scheduler (issue #45). This site is
// self-hosted as a single long-lived Node process rather than something with
// an OS crontab available, so the daily TAIFEX sync is scheduled from inside
// the app itself via node-cron instead. Started once from instrumentation.ts
// (Next.js's supported hook for one-time server-start code — see its own
// comment for why that's the right place).
import cron from "node-cron";
import { syncExchangeRates } from "@/lib/exchangeRates";

let started = false;

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

  // Also sync once immediately on boot, so the footer/listing pages have a
  // rate to show right away after a deploy/restart rather than waiting for
  // the next 08:10 tick.
  syncExchangeRates().catch((error) => {
    console.error("[exchangeRates] startup sync failed", error);
  });
}
