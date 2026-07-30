import { readFileSync } from "fs";
import { join } from "path";
import mysql from "mysql2/promise";

let pool: mysql.Pool | undefined;
let ready: Promise<void> | undefined;

function createPool(): mysql.Pool {
  return mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: process.env.MYSQL_SSL === "true" ? {} : undefined,
    connectionLimit: 5,
    multipleStatements: true,
  });
}

async function ensureSchema(db: mysql.Pool): Promise<void> {
  const sql = readFileSync(join(process.cwd(), "db", "init.sql"), "utf-8");
  await db.query(sql);
}

export async function getDb(): Promise<mysql.Pool> {
  if (!pool) {
    pool = createPool();
  }
  if (!ready) {
    ready = ensureSchema(pool);
  }
  await ready;
  return pool;
}
