// One-time import: crawls nicepigeon.com's 鴿店資訊 article listing
// (news.php?classid=8, paginated via &page=N), visits every article's
// detail page (news_detail.php?id=N), extracts each pigeon shop's
// name/phone/address, geocodes the address via OpenStreetMap Nominatim, and
// writes the result into the `pigeon_shops` table (see db/init.sql).
//
// Issue #243 (part of Epic #239). Content is already Traditional Chinese —
// no translation step, unlike the news/races sync scripts (#1/#2) sharing
// this epic. Deliberately NOT wired into lib/scheduler.ts's daily cron (see
// that file) — this is meant to be run once, by hand, then the data is
// maintained through the admin CRUD page (app/z04urru6/pigeon-shops).
// Modeled on scripts/migrate-description-html.mjs: defaults to a dry run
// (crawl + parse + report only, no geocoding, no DB writes) and only
// geocodes/writes with --apply.
//
// Usage:
//   node scripts/import-pigeon-shops.mjs            # dry run: crawl + parse + report only
//   node scripts/import-pigeon-shops.mjs --apply     # geocode + write rows to pigeon_shops
//
// Nominatim usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// requires a descriptive User-Agent identifying the application/contact, and
// caps automated use at 1 request/second — both honored below.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as cheerio from "cheerio";
import mysql from "mysql2/promise";

// Minimal .env loader — see migrate-description-html.mjs for the fuller
// header comment on why this is needed (this script runs standalone via
// `node`, outside Next.js's own env loading).
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

const APPLY = process.argv.includes("--apply");

const SITE_ORIGIN = "https://www.nicepigeon.com";
const LIST_PATH = "/news.php?classid=8";
const CRAWL_USER_AGENT =
  "bid-pigeon-shops-import/1.0 (one-time crawl for https://github.com/j172/bid issue #243; contact: j1720728@gmail.com)";
const NOMINATIM_USER_AGENT =
  "bid-pigeon-shops-import/1.0 (+https://github.com/j172/bid issue #243; contact: j1720728@gmail.com)";
const NOMINATIM_MIN_INTERVAL_MS = 1100; // Nominatim policy: max 1 request/second — pad slightly over.

async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": CRAWL_USER_AGENT } });
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

// Discovers every news_detail.php?id=N link + title across every paginated
// list page, starting at page 1 and stopping the first time a page yields
// no new (not-already-seen) article ids — handles both "there's no page N+1
// at all" and "page N+1 redirects back to page 1 with the same articles"
// without needing to pre-parse the pager's max-page number.
async function discoverArticles() {
  const seen = new Map(); // id -> title
  const order = [];
  let page = 1;

  for (;;) {
    const url = page === 1 ? `${SITE_ORIGIN}${LIST_PATH}` : `${SITE_ORIGIN}${LIST_PATH}&page=${page}`;
    const html = await fetchText(url);
    const $ = cheerio.load(html);

    let newOnThisPage = 0;
    $('a[href^="news_detail.php?id="]').each((_, el) => {
      const href = $(el).attr("href");
      const match = href && href.match(/id=(\d+)/);
      if (!match) return;
      const id = match[1];
      const title = $(el).find("h5").first().text().trim();
      if (!seen.has(id)) {
        seen.set(id, title || null);
        order.push(id);
        newOnThisPage++;
      }
    });

    console.log(`list page ${page}: ${newOnThisPage} new article(s) (${seen.size} total so far)`);
    if (newOnThisPage === 0) break;
    page++;
    if (page > 200) {
      // Sanity guard against an infinite loop if the site's pagination ever
      // behaves unexpectedly (e.g. always "new" ids from a broken query).
      console.warn("Stopping after 200 list pages as a safety guard.");
      break;
    }
  }

  return order.map((id) => ({ id, title: seen.get(id), url: `${SITE_ORIGIN}/news_detail.php?id=${id}` }));
}

// Article detail pages hold every shop for that region as a run of
// `<p>` blocks inside a single <div class="container mt-3">, but the exact
// markup shape varies by article (confirmed by fetching several live pages
// while building this script):
//   Format A: "<p>NAME<br>電話：PHONE<br>地址：ADDRESS</p>" — name, phone,
//     address all in one <p>, separated by <br>.
//   Format B: "<p>NAME 電話：PHONE</p>" followed by a separate
//     "<p>地址：ADDRESS</p>", with "<p><strong>【區名】</strong></p>"
//     sub-headers and "<p>&nbsp;</p>" spacers interspersed.
// Some shops are genuinely missing a phone or an address in the source
// (confirmed on live pages, e.g. 屏東 https://www.nicepigeon.com/news_detail.php?id=667
// lists two shops with no address at all). Rather than special-case each
// markup shape, this flattens the whole container to a line-per-<br>/<p>
// text stream and walks it as a small state machine, which handles both
// formats (and the missing-field cases) uniformly.
export function extractShopsFromHtml(html) {
  const $ = cheerio.load(html);
  const container = $("div.container.mt-3").first();
  if (container.length === 0) return [];

  // Turn <br> and </p><p> boundaries into newlines before stripping tags,
  // so each visual line survives as its own text line.
  container.find("br").replaceWith("\n");
  container.find("p").each((_, el) => {
    $(el).append("\n");
  });
  const text = container.text();

  const lines = text
    .split("\n")
    .map((line) => line.replace(/ /g, " ").trim())
    .filter((line) => line.length > 0);

  const shops = [];
  let current = null;
  let pendingName = null;

  const flush = () => {
    if (current && current.name) shops.push(current);
    current = null;
  };

  const isDistrictHeader = (line) => /^【.*】$/.test(line);
  // Matches "電話" or "電話："/"電話:" with either full- or half-width colon,
  // optionally with a name before it on the same line (Format B).
  const phoneRe = /電話\s*[:：]?\s*(.*)$/;
  const addressRe = /地址\s*[:：]?\s*(.*)$/;

  for (const line of lines) {
    if (isDistrictHeader(line)) {
      flush();
      pendingName = null;
      continue;
    }

    const addressMatch = line.match(addressRe);
    if (addressMatch) {
      if (!current) {
        current = { name: pendingName || "", phone: null, address: null };
        pendingName = null;
      }
      const address = addressMatch[1].trim();
      if (address) current.address = address;
      continue;
    }

    const phoneMatch = line.match(phoneRe);
    if (phoneMatch) {
      const namePart = line.slice(0, line.indexOf("電話")).trim();
      flush();
      current = { name: namePart || pendingName || "", phone: phoneMatch[1].trim() || null, address: null };
      pendingName = null;
      continue;
    }

    // Plain line with neither keyword — a shop name on its own line,
    // starting a new entry.
    flush();
    pendingName = line;
  }
  flush();
  if (pendingName) shops.push({ name: pendingName, phone: null, address: null });

  return shops.filter((shop) => shop.name);
}

// Nominatim's Taiwan coverage is street-level at best for most addresses —
// exact house numbers (門牌號) are rarely mapped, so querying a scraped
// address verbatim (e.g. "900 屏東市福州街82號") returns zero results far
// more often than not (confirmed against nicepigeon's real addresses while
// building this script: the exact house number essentially never resolves,
// but the same address with the house number/巷/弄/段 suffix stripped back
// to the road usually does). To keep the map usefully populated instead of
// mostly empty, each address is retried at progressively coarser precision
// — full address first, then with trailing house-number/弄/巷/段 tokens
// peeled off one at a time — stopping at the first candidate that resolves.
// This only affects what's *sent to Nominatim*; the original scraped
// address is always what's stored in pigeon_shops.address.
export function addressGeocodeCandidates(address) {
  const trailingTokenRe = /(\d+(?:之\d+)*號|\d+弄|\d+巷|\d+段)\s*$/;
  const candidates = [address];
  let current = address;
  for (;;) {
    const stripped = current.replace(trailingTokenRe, "").trim();
    if (!stripped || stripped === current) break;
    candidates.push(stripped);
    current = stripped;
  }
  return candidates;
}

let lastNominatimCallAt = 0;
async function nominatimSearch(query) {
  const wait = lastNominatimCallAt + NOMINATIM_MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastNominatimCallAt = Date.now();

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=tw&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { "User-Agent": NOMINATIM_USER_AGENT } });
  if (!response.ok) {
    console.warn(`  geocode failed (${response.status}): ${query}`);
    return null;
  }
  const results = await response.json();
  if (!Array.isArray(results) || results.length === 0) return null;
  const { lat, lon } = results[0];
  const parsedLat = Number(lat);
  const parsedLng = Number(lon);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;
  return { lat: parsedLat, lng: parsedLng };
}

async function geocode(address) {
  for (const candidate of addressGeocodeCandidates(address)) {
    const result = await nominatimSearch(candidate);
    if (result) {
      if (candidate !== address) {
        console.log(`  geocoded via fallback "${candidate}" (from "${address}")`);
      }
      return result;
    }
  }
  return null;
}

async function existingShop(pool, name, address) {
  const [rows] = await pool.query(
    "SELECT id FROM pigeon_shops WHERE name = ? AND address <=> ? LIMIT 1",
    [name, address],
  );
  return rows.length > 0 ? rows[0].id : null;
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (will geocode + write to DB)" : "DRY RUN (parse + report only)"}`);
  console.log(`Fetching article list from ${SITE_ORIGIN}${LIST_PATH} ...`);

  const articles = await discoverArticles();
  console.log(`\nFound ${articles.length} article(s) across the pigeon-shop directory.\n`);

  const allShops = [];
  for (const article of articles) {
    const html = await fetchText(article.url);
    const shops = extractShopsFromHtml(html);
    const missingPhone = shops.filter((s) => !s.phone).length;
    const missingAddress = shops.filter((s) => !s.address).length;
    console.log(
      `${article.title ?? article.id} (${article.url}): ${shops.length} shop(s)` +
        (missingPhone || missingAddress ? ` — missing phone: ${missingPhone}, missing address: ${missingAddress}` : ""),
    );
    for (const shop of shops) {
      allShops.push({ ...shop, sourceUrl: article.url });
    }
  }

  console.log(`\nTotal shops parsed: ${allShops.length}`);
  const withPhone = allShops.filter((s) => s.phone).length;
  const withAddress = allShops.filter((s) => s.address).length;
  console.log(`  with phone: ${withPhone} (${allShops.length - withPhone} missing)`);
  console.log(`  with address: ${withAddress} (${allShops.length - withAddress} missing)`);

  if (!APPLY) {
    console.log("\n[dry run] Sample of parsed shops:");
    for (const shop of allShops.slice(0, 10)) {
      console.log(`  - ${shop.name} | ${shop.phone ?? "(無電話)"} | ${shop.address ?? "(無地址)"}`);
    }
    console.log("\nRe-run with --apply to geocode addresses and write rows into pigeon_shops.");
    return;
  }

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    ssl: process.env.MYSQL_SSL === "true" ? {} : undefined,
  });

  let inserted = 0;
  let skippedExisting = 0;
  let geocoded = 0;
  let geocodeFailed = 0;

  try {
    for (const shop of allShops) {
      const dupId = await existingShop(pool, shop.name, shop.address);
      if (dupId) {
        skippedExisting++;
        console.log(`skip (already imported as #${dupId}): ${shop.name}`);
        continue;
      }

      let lat = null;
      let lng = null;
      if (shop.address) {
        const coords = await geocode(shop.address);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
          geocoded++;
        } else {
          geocodeFailed++;
          console.warn(`  no geocode result for: ${shop.address}`);
        }
      }

      await pool.query(
        `INSERT INTO pigeon_shops (name, phone, address, lat, lng, source_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [shop.name, shop.phone, shop.address, lat, lng, shop.sourceUrl],
      );
      inserted++;
      console.log(`inserted: ${shop.name} (${lat ?? "no lat"}, ${lng ?? "no lng"})`);
    }
  } finally {
    await pool.end();
  }

  console.log(
    `\nDone. ${inserted} row(s) inserted, ${skippedExisting} skipped (already present), ` +
      `${geocoded} geocoded successfully, ${geocodeFailed} geocode lookup(s) returned no result.`,
  );
}

// Guarded so importing this module's pure helpers (extractShopsFromHtml,
// addressGeocodeCandidates) from a test file doesn't also trigger a live
// network crawl as a side effect of the import.
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
