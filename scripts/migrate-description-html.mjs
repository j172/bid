// One-off migration: converts existing listings.description values (plain
// text, written before the TinyMCE rich-text editor existed) into safe HTML
// equivalents, so the public listing page can render *every* description
// through dangerouslySetInnerHTML the same way, without a legacy plain-text
// fallback path.
//
// Deliberately NOT wired into lib/db.ts's automatic ensureSchema() startup
// checks (unlike its ALTER TABLE helpers) — this mutates existing row
// *content*, not just shape, so it's meant to be run once, by hand, at a
// time of your choosing. Defaults to a dry run; pass --apply to write.
//
// Usage:
//   node scripts/migrate-description-html.mjs            # preview only
//   node scripts/migrate-description-html.mjs --apply     # actually update rows
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";

// Minimal .env loader — this script runs standalone via `node`, outside
// Next.js's own env loading, so .env.local / .env aren't picked up otherwise.
// Existing process.env values always win (e.g. if you export vars yourself).
function loadEnvFile(fileName) {
  const path = join(process.cwd(), fileName);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    const [, key, rawValue = ""] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(".env");
loadEnvFile(".env.local");

const DRY_RUN = !process.argv.includes("--apply");

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Plain text -> HTML: blank-line-separated blocks become <p> tags; single
// newlines within a block become <br>. Mirrors how the old <textarea
// whitespace-pre-wrap> rendering treated whitespace.
function plainTextToHtml(text) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => `<p>${escapeHtml(block).split("\n").join("<br>")}</p>`);
  return paragraphs.length > 0 ? paragraphs.join("") : `<p>${escapeHtml(text.trim())}</p>`;
}

// Anything already starting with a tag is assumed to already be migrated
// (or otherwise not the plain-text shape this script targets) and is left
// alone — makes the script safe to re-run without double-converting rows.
function looksLikeHtml(description) {
  return /^\s*</.test(description);
}

async function main() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: process.env.MYSQL_SSL === "true" ? {} : undefined,
  });

  try {
    const [rows] = await pool.query("SELECT id, description FROM listings");
    let converted = 0;
    let skipped = 0;

    for (const row of rows) {
      if (looksLikeHtml(row.description)) {
        skipped++;
        continue;
      }

      const html = plainTextToHtml(row.description);
      converted++;

      if (DRY_RUN) {
        console.log(`\n--- listing ${row.id} (dry run) ---`);
        console.log("before:", JSON.stringify(row.description.slice(0, 200)));
        console.log("after: ", JSON.stringify(html.slice(0, 200)));
      } else {
        await pool.query("UPDATE listings SET description = ? WHERE id = ?", [html, row.id]);
        console.log(`listing ${row.id}: converted`);
      }
    }

    console.log(
      `\n${DRY_RUN ? "[dry run] " : ""}${converted} row(s) ${DRY_RUN ? "would be" : "were"} converted, ${skipped} already HTML / skipped.`,
    );
    if (DRY_RUN && converted > 0) {
      console.log("Re-run with --apply to write these changes.");
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
