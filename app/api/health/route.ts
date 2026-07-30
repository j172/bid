import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  let dbOk = false;
  let dbError: string | undefined;

  try {
    const db = await getDb();
    const [rows] = await db.query("SELECT 1 AS ok");
    dbOk = Array.isArray(rows) && rows.length === 1;
  } catch (error) {
    dbError = error instanceof Error ? error.message : String(error);
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
