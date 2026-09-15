// Shared "最近一次成功執行時間" tracker, generic across scheduled jobs (issue
// #261) — see db/init.sql's sync_runs comment for the full story this backs.
// Originally backed the daily herbots.be news sync's post-boot catch-up
// check in lib/scheduler.ts (getLastRunAt()/isSyncStale() decided whether a
// catch-up sync was warranted — see that module's former header comment for
// why the check couldn't be "just sync on every boot", this host restarts
// often per issue #81); that news sync pipeline (and its use of this module)
// was removed in issue #280, so this module currently has no caller. Kept in
// case a future scheduled job wants the same staleness-based catch-up
// mechanism — see SyncJobName below, which would need a new member added.
import { getDb } from "@/lib/db";

export type SyncJobName = "news";

interface SyncRunRow {
  last_run_at: string | Date;
}

// Null covers both "this job has never completed a run on this database"
// (fresh install) and any other missing-row case — callers treat both the
// same as "definitely stale" (see isSyncStale below).
export async function getLastRunAt(jobName: SyncJobName): Promise<Date | null> {
  const db = await getDb();
  const [rows] = await db.query("SELECT last_run_at FROM sync_runs WHERE job_name = ?", [jobName]);
  const row = (rows as SyncRunRow[])[0];
  return row ? new Date(row.last_run_at) : null;
}

// Upserts job_name's timestamp to "now" (server time, via SQL NOW() rather
// than a JS Date parameter, so this stays correct regardless of the app
// server's own clock/timezone relative to MySQL's).
export async function recordRunNow(jobName: SyncJobName): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO sync_runs (job_name, last_run_at) VALUES (?, NOW())
     ON DUPLICATE KEY UPDATE last_run_at = VALUES(last_run_at)`,
    [jobName],
  );
}

// Pure, so lib/scheduler.ts's "should a catch-up sync fire on boot" decision
// is directly unit-testable without mocking the database (see
// lib/syncRuns.test.ts). True when lastRunAt is missing entirely (this job
// has never recorded a completed run) or older than thresholdHours relative
// to now.
export function isSyncStale(lastRunAt: Date | null, now: Date, thresholdHours: number): boolean {
  if (!lastRunAt) return true;
  const ageMs = now.getTime() - lastRunAt.getTime();
  return ageMs > thresholdHours * 60 * 60 * 1000;
}
