import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

// Public, unauthenticated liveness probe (scripts/remote-verify.sh polls it).
// Because it is unauthenticated, it must not echo the raw driver error back
// to the caller (issue #140 M-4): mysql2 connection failures routinely carry
// the DB username and an internal host/IP ("Access denied for user
// 'xxx'@'10.x.x.x'"), which would hand an attacker free reconnaissance during
// any window where the database is briefly unreachable. The detail goes to
// the server log instead; the response carries a fixed string in production
// and keeps the real message in dev, where it is the whole point of the
// endpoint and nobody untrusted is reading it.
const GENERIC_DB_ERROR = "db unavailable";

export async function GET() {
  let dbOk = false;
  let dbError: string | undefined;

  try {
    const db = await getDb();
    const [rows] = await db.query("SELECT 1 AS ok");
    dbOk = Array.isArray(rows) && rows.length === 1;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[health] database check failed:", error);
    dbError = process.env.NODE_ENV === "production" ? GENERIC_DB_ERROR : detail;
  }

  return NextResponse.json(
    {
      ok: dbOk,
      app: "bid",
      time: new Date().toISOString(),
      db: dbOk ? "connected" : "error",
      ...(dbError ? { dbError } : {}),
    },
    { status: dbOk ? 200 : 500 },
  );
}
