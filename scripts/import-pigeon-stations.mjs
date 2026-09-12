// One-time import (issue #242 / Epic #239): scrapes nicepigeon.com's
// "交流道取鴿站所查詢" article — a plain-HTML PHP page listing ~30 pigeon
// pickup stations (取鴿站) across Taiwan, grouped by region, formatted as
// "<name> | <phone> | <address>" tables — geocodes each address via
// OpenStreetMap Nominatim, and writes the rows into the `pigeon_stations`
// table (see db/init.sql).
//
// Deliberately standalone, run once by hand (same pattern as
// scripts/migrate-description-html.mjs) — NOT wired into lib/scheduler.ts's
// daily cron. After this runs, station data is maintained by hand through
// the admin CRUD at app/z04urru6/pigeon-stations instead of by re-running
// this script.
//
// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/)
// requires a descriptive User-Agent identifying the application/maintainer
// and caps automated use at 1 request/second — both honoured below.
//
// Defaults to a dry run (fetch + parse + geocode + preview only, no DB
// connection at all). Pass --apply to actually write rows.
//
// Usage:
//   node scripts/import-pigeon-stations.mjs             # preview only, no DB needed
//   node scripts/import-pigeon-stations.mjs --apply       # write rows into pigeon_stations
//   node scripts/import-pigeon-stations.mjs --apply --source=./local.html   # parse a saved copy instead of fetching
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { JSDOM } from "jsdom";

const SOURCE_URL = "https://nicepigeon.com/news_detail.php?id=16";

// Nominatim's own /ui hostname is documented as the free public endpoint;
// contact info in the User-Agent is required by their usage policy in lieu
// of a paid account. service@xiangshuicn.cc is this site's existing public
// support address (see messages/*.json footer.supportEmail), not a secret.
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const NOMINATIM_USER_AGENT =
  "xiangshuicn.cc-pigeon-stations-import/1.0 (+https://xiangshuicn.cc; contact: service@xiangshuicn.cc)";
// Nominatim's usage policy caps unauthenticated use at 1 request/second —
// 1100ms keeps a safety margin over the hard 1000ms floor.
const NOMINATIM_MIN_INTERVAL_MS = 1100;

const DRY_RUN = !process.argv.includes("--apply");
const sourceArg = process.argv.find((arg) => arg.startsWith("--source="));
const LOCAL_SOURCE_PATH = sourceArg ? sourceArg.slice("--source=".length) : null;

// Minimal .env loader — this script runs standalone via `node`, outside
// Next.js's own env loading, so .env.local / .env aren't picked up
// otherwise. Existing process.env values always win. Mirrors
// scripts/migrate-description-html.mjs's loader exactly.
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Fetch + parse
// ---------------------------------------------------------------------------

async function fetchSourceHtml() {
  if (LOCAL_SOURCE_PATH) {
    console.log(`Reading cached HTML from ${LOCAL_SOURCE_PATH} instead of fetching ${SOURCE_URL}`);
    return readFileSync(LOCAL_SOURCE_PATH, "utf8");
  }
  const response = await fetch(SOURCE_URL, {
    headers: {
      // nicepigeon.com is a classic PHP site with no JS rendering (verified
      // by hand before writing this script) but still worth identifying as
      // a real browser UA rather than the default Node fetch UA, which some
      // hosts reject outright.
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: HTTP ${response.status}`);
  }
  return response.text();
}

// Cell text: collapse the whitespace between a <td>'s (possibly multiple)
// nested <p>/<span> lines into single spaces, e.g. an address split across
// two <p> lines ("...569號" / "(營業時間中午12:00週四公休)") becomes one
// "...569號 (營業時間中午12:00週四公休)" string.
function cellText(el) {
  return (el.textContent ?? "").replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

// The article body is one <div class="container mt-3"> holding, in order,
// a region heading <p> (e.g. "台北/新北"), a <table> of stations for that
// region, a spacer "<p>&nbsp;</p>", the next region heading, and so on.
// Table rows are <tr><td>name</td><td>phone</td><td>address</td></tr>; the
// 高雄 table's HTML has one trailing empty <tr></tr> with no <td>s at all,
// which is skipped below.
function parseStations(html) {
  const dom = new JSDOM(html);
  const container = dom.window.document.querySelector(".container.mt-3");
  if (!container) {
    throw new Error("Could not find the expected '.container.mt-3' article body — page markup may have changed");
  }

  const stations = [];
  let currentRegion = null;

  for (const el of container.children) {
    if (el.tagName === "P") {
      const text = cellText(el);
      if (text) currentRegion = text; // non-empty <p> = region heading; empty ones are pure spacers
      continue;
    }
    if (el.tagName !== "TABLE") continue;

    for (const row of el.querySelectorAll("tbody tr")) {
      const cells = row.querySelectorAll("td");
      if (cells.length < 3) continue; // the stray trailing empty <tr></tr>

      const name = cellText(cells[0]);
      const phone = cellText(cells[1]);
      const address = cellText(cells[2]);
      if (!name || !phone || !address) continue;

      stations.push({ region: currentRegion, name, phone, address });
    }
  }

  return stations;
}

// ---------------------------------------------------------------------------
// Address normalization for geocoding — the source addresses are written
// the way a local reader already knows the area (e.g. "三重區河邊北街166號"
// with no leading "新北市"), which Nominatim usually can't resolve on its
// own. The DB `address` column always keeps the original text unchanged;
// this section only builds *candidate search queries*.
// ---------------------------------------------------------------------------

const KNOWN_CITY_COUNTY = [
  "台北市", "新北市", "桃園市", "台中市", "台南市", "高雄市",
  "基隆市", "新竹市", "嘉義市",
  "新竹縣", "苗栗縣", "彰化縣", "南投縣", "雲林縣", "嘉義縣",
  "屏東縣", "宜蘭縣", "花蓮縣", "台東縣", "澎湖縣", "金門縣", "連江縣",
];

// District -> city/county, for the specific districts that appear in this
// page's addresses without their county/city prefix. Ordered so a more
// specific key (e.g. "水上鄉") is checked before a shorter one that would
// also match its prefix (e.g. "水上", needed for "水上交流道邊(南下旁)",
// which lacks the "鄉" suffix entirely).
const DISTRICT_TO_CITY = [
  ["三重區", "新北市"],
  ["蘆竹區", "桃園市"],
  ["中壢區", "桃園市"],
  ["楊梅區", "桃園市"],
  ["頭份鎮", "苗栗縣"],
  ["公館鄉", "苗栗縣"],
  ["溪湖鎮", "彰化縣"],
  ["西螺鎮", "雲林縣"],
  ["斗南鎮", "雲林縣"],
  ["大林鎮", "嘉義縣"],
  ["水上鄉", "嘉義縣"],
  ["水上", "嘉義縣"],
  ["新營區", "台南市"],
  ["麻豆區", "台南市"],
  ["安定區", "台南市"],
  ["永康區", "台南市"],
  ["仁德區", "台南市"],
  ["燕巢區", "高雄市"],
  ["楠梓區", "高雄市"],
];

function ensureCityPrefix(address) {
  if (KNOWN_CITY_COUNTY.some((city) => address.startsWith(city))) return address;
  for (const [district, city] of DISTRICT_TO_CITY) {
    if (address.startsWith(district)) return city + address;
  }
  return address;
}

// Coarser fallbacks tried only if the fully-prefixed address doesn't
// resolve — a city+district or city-only match at least lands the pin
// within the right area rather than leaving it unset.
function cityDistrictFallback(address) {
  const match = address.match(/^([一-龥]{2,3}[市縣])([一-龥]{1,4}[區鄉鎮市])/);
  return match ? match[1] + match[2] : null;
}

function cityOnlyFallback(address) {
  const match = address.match(/^([一-龥]{2,3}[市縣])/);
  return match ? match[1] : null;
}

function buildCandidateQueries(rawAddress) {
  // Strip parenthetical notes ("(不定時公休)", "(往北上交流道)", ...) — they're
  // useful context for a human visitor, not for a geocoder.
  const stripped = rawAddress.replace(/[(（][^)）]*[)）]/g, "").trim();
  const prefixedStripped = ensureCityPrefix(stripped || rawAddress);
  const prefixedRaw = ensureCityPrefix(rawAddress.trim());

  const candidates = [prefixedStripped, prefixedRaw, cityDistrictFallback(prefixedStripped), cityOnlyFallback(prefixedStripped)].filter(
    (value) => Boolean(value),
  );

  return Array.from(new Set(candidates));
}

// ---------------------------------------------------------------------------
// Nominatim geocoding — rate-limited to <= 1 request/second.
// ---------------------------------------------------------------------------

let lastRequestAt = 0;
async function throttle() {
  const wait = lastRequestAt + NOMINATIM_MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function nominatimSearch(query) {
  await throttle();
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "tw");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": NOMINATIM_USER_AGENT,
      "Accept-Language": "zh-TW",
    },
  });
  if (!response.ok) {
    throw new Error(`Nominatim request failed for "${query}": HTTP ${response.status}`);
  }
  const results = await response.json();
  return Array.isArray(results) && results.length > 0 ? results[0] : null;
}

// Coarse Taiwan bounding box (includes Kinmen/Matsu/Penghu) used as a sanity
// check on Nominatim's result — free-text CJK queries occasionally get a
// wildly unrelated single-node match (e.g. a shop or plaque whose name just
// happens to share tokens with the query) rather than a real "no match".
// countrycodes=tw already scopes the search, but this catches that failure
// mode too instead of silently writing an obviously-wrong coordinate.
const TAIWAN_BOUNDS = { minLat: 21.5, maxLat: 26.5, minLng: 118.0, maxLng: 122.5 };
function isWithinTaiwan(lat, lng) {
  return lat >= TAIWAN_BOUNDS.minLat && lat <= TAIWAN_BOUNDS.maxLat && lng >= TAIWAN_BOUNDS.minLng && lng <= TAIWAN_BOUNDS.maxLng;
}

async function geocodeAddress(rawAddress) {
  const candidates = buildCandidateQueries(rawAddress);
  for (const candidate of candidates) {
    let result;
    try {
      // No leading "台灣" — countrycodes=tw already scopes the search, and
      // prepending it as free text was observed (during manual verification
      // of this script's output) to sometimes throw off Nominatim's CJK
      // tokenizer into matching an unrelated place whose name merely
      // contained similar tokens, e.g. "新營區" alone matching the correct
      // 臺南市新營區 while "台灣台南市新營區" matched an unrelated Taipei POI.
      result = await nominatimSearch(candidate);
    } catch (error) {
      console.error(`  geocode error for "${candidate}":`, error.message);
      continue;
    }
    if (!result) continue;

    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (!isWithinTaiwan(lat, lng)) {
      console.warn(`  discarding out-of-bounds match for "${candidate}": ${lat}, ${lng} (${result.display_name})`);
      continue;
    }
    return { lat, lng, matchedQuery: candidate };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Fetching ${LOCAL_SOURCE_PATH ? `(local copy) ${LOCAL_SOURCE_PATH}` : SOURCE_URL}...`);
  const html = await fetchSourceHtml();

  const stations = parseStations(html);
  console.log(`Parsed ${stations.length} station(s) from the source page.\n`);
  if (stations.length === 0) {
    throw new Error("Parsed zero stations — the page markup likely changed; inspect it before re-running.");
  }

  const geocoded = [];
  for (const [index, station] of stations.entries()) {
    const geo = await geocodeAddress(station.address);
    geocoded.push({ ...station, lat: geo?.lat ?? null, lng: geo?.lng ?? null });
    const progress = `[${index + 1}/${stations.length}]`;
    if (geo) {
      console.log(
        `${progress} ${station.region} | ${station.name} | ${station.phone} | ${station.address} -> ${geo.lat}, ${geo.lng} (matched "${geo.matchedQuery}")`,
      );
    } else {
      console.log(
        `${progress} ${station.region} | ${station.name} | ${station.phone} | ${station.address} -> GEOCODE FAILED (no Nominatim match for any candidate query)`,
      );
    }
  }

  const geocodedCount = geocoded.filter((station) => station.lat !== null).length;
  console.log(
    `\nGeocoded ${geocodedCount}/${geocoded.length} station(s) successfully; ${geocoded.length - geocodedCount} left with lat/lng = NULL for manual follow-up.`,
  );

  if (DRY_RUN) {
    console.log("\n[dry run] No database connection was made. Re-run with --apply to write these rows into pigeon_stations.");
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

  try {
    let inserted = 0;
    let skipped = 0;
    for (const station of geocoded) {
      // Idempotency check: this script is meant to run once, but re-running
      // it (e.g. after fixing a parsing bug) shouldn't duplicate rows for
      // stations already imported.
      const [existingRows] = await pool.query(
        "SELECT id FROM pigeon_stations WHERE name = ? AND address = ? LIMIT 1",
        [station.name, station.address],
      );
      if (existingRows.length > 0) {
        console.log(`skip (already imported): ${station.name}`);
        skipped++;
        continue;
      }

      await pool.query(
        `INSERT INTO pigeon_stations (name, phone, address, lat, lng, source_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [station.name, station.phone, station.address, station.lat, station.lng, SOURCE_URL],
      );
      console.log(`inserted: ${station.name}`);
      inserted++;
    }

    console.log(`\n${inserted} row(s) inserted, ${skipped} already existed and were skipped.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
