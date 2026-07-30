import mysql from "mysql2/promise";

let pool: mysql.Pool | undefined;

export function getDb(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT ?? 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      ssl: process.env.MYSQL_SSL === "true" ? {} : undefined,
      connectionLimit: 5,
    });
  }
  return pool;
}
