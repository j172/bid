// De-dup ledger for the herbots.be news sync (issue #240) — see db/init.sql's
// news_import_log comment for why this is a separate table from news_posts:
// a row here is written once on successful import and never deleted or
// edited again, so it keeps blocking re-import of a source_url even after
// the corresponding news_posts row has been edited or deleted by an admin.
// Hand-written SQL via mysql2, same style as lib/news.ts (no ORM).
import { getDb } from "@/lib/db";

export async function hasImportedSourceUrl(sourceUrl: string): Promise<boolean> {
  const db = await getDb();
  const [rows] = await db.query("SELECT 1 FROM news_import_log WHERE source_url = ? LIMIT 1", [sourceUrl]);
  return (rows as unknown[]).length > 0;
}

// Called once per successfully-imported article, right after the news_posts
// INSERT succeeds. newsPostId is stored purely for operator debugging
// ("which row did this log entry create?") — nothing reads it back to decide
// de-dup, that's always a plain source_url lookup above, so it staying stale
// after a later delete is harmless.
export async function recordImportedSourceUrl(source: string, sourceUrl: string, newsPostId: number): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO news_import_log (source, source_url, news_post_id, imported_at) VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE news_post_id = VALUES(news_post_id)`,
    [source, sourceUrl, newsPostId],
  );
}
