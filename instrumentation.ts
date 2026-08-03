// Next.js's supported hook for one-time code that should run when a server
// instance boots (both `next dev` and `next start`/production, but not
// during `next build` itself) — see
// https://nextjs.org/docs/app/guides/instrumentation. This project has no
// external crontab (self-hosted single Node process), so this is where the
// in-process exchange-rate scheduler (issue #45) gets started, instead of
// wiring it up per-request somewhere in the request path.
export async function register() {
  // register() also runs once for the Edge runtime (middleware); node-cron
  // needs real Node APIs, so only start it for the Node.js server runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}
