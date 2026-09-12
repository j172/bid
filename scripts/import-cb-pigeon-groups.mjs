// One-time import (issue #260 / Epic #239): crawls cb-pigeon.com's（凱克博
// 賽鴿資訊網）鴿會查詢 section — three regional listing pages
// (/group/{n,w,s}, each listing its groups directly with no pagination),
// visits every group's /group/view/{id} detail page, extracts name/address/
// chairman/secretary/website/pigeon-tracking-link, resolves lat/lng, and
// writes the result into the `pigeon_groups` table (see db/init.sql).
//
// Sibling script to scripts/import-pigeon-shops.mjs — same
// dry-run-by-default / --apply shape, same "run once by hand, then maintain
// through the admin CRUD" lifecycle (app/z04urru6/pigeon-groups), same
// deliberate exclusion from lib/scheduler.ts's daily cron.
//
// One deliberate difference from import-pigeon-shops.mjs: THIS script's dry
// run still crawls the network and resolves coordinates (Google Maps embed
// parse, falling back to Nominatim geocoding) — it just skips the DB
// connection and the writes. That's required to satisfy issue #260's dry-run
// acceptance criterion ("印出...座標來源統計（嵌入地圖 vs Nominatim fallback
// vs 失敗）"), which needs the geocode fallback to actually run so the stats
// are real. import-pigeon-shops.mjs's dry run skips geocoding entirely
// instead; there's no shared module between the two scripts to keep the two
// dry-run behaviours in sync, so this note exists in lieu of one.
//
// Usage:
//   node scripts/import-cb-pigeon-groups.mjs            # dry run: crawl + parse + geocode + report only
//   node scripts/import-cb-pigeon-groups.mjs --apply     # also write rows to pigeon_groups
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

const SITE_ORIGIN = "https://www.cb-pigeon.com";
const REGIONS = ["n", "w", "s"];
const CRAWL_USER_AGENT =
  "bid-cb-pigeon-groups-import/1.0 (one-time crawl for https://github.com/j172/bid issue #260; contact: j1720728@gmail.com)";
const NOMINATIM_USER_AGENT =
  "bid-cb-pigeon-groups-import/1.0 (+https://github.com/j172/bid issue #260; contact: j1720728@gmail.com)";
const NOMINATIM_MIN_INTERVAL_MS = 1100; // Nominatim policy: max 1 request/second — pad slightly over.

async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": CRAWL_USER_AGENT } });
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

// Each regional listing page (/group/n, /group/w, /group/s) lists every
// group in that region directly as `<a href="/group/view/{id}">` cards, with
// no pagination — unlike nicepigeon.com's article-listing pages, there's no
// "next page" to discover. Pure/offline: takes already-fetched HTML.
export function discoverGroupIds(html) {
  const $ = cheerio.load(html);
  const ids = [];
  const seen = new Set();
  $('a[href^="/group/view/"]').each((_, el) => {
    const href = $(el).attr("href");
    const match = href && href.match(/\/group\/view\/(\d+)/);
    if (!match) return;
    const id = match[1];
    if (seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  });
  return ids;
}

// A detail page's embedded Google Maps <iframe> comes in three shapes,
// confirmed by fetching every one of the ~104 real detail pages while
// building this script:
//   1. The modern "embed" API: .../maps/embed?pb=...!2d<lng>!3d<lat>!...
//      (issue #260's spec — this is the priority source, parsed below).
//   2. A legacy maps.google.com.tw/maps?...&q=<address>&sll=...&ll=<lat>,<lng>
//      "search result" redirect link — the large majority of real pages (no
//      !2d/!3d tokens at all, so the regex below naturally doesn't match).
//   3. A legacy Street View panorama embed
//      (.../maps/embed?pb=!1m0!...!6m8!1m7!1s<panoid>!2m2!1d<lat>!2d<lng>!3f...) —
//      uses `!1d<lat>!2d<lng>` (a *different* token order/meaning), and also
//      has no `!3d` token, so it too falls through safely rather than being
//      misparsed as lng/lat swapped.
// Shapes 2 and 3 both fall back to Nominatim geocoding in main() below,
// which is the intended, spec'd behavior ("解析不到才 fallback Nominatim").
export function parseGoogleMapsEmbedCoordinates(iframeSrc) {
  if (!iframeSrc) return null;
  const match = iframeSrc.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lng = Number(match[1]);
  const lat = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// Strips a leading "LABEL：" / "LABEL:" prefix off a `.info` row's flattened
// text (e.g. "會長：廖世志" -> "廖世志"). A no-op (returns the original,
// trimmed) when there's no colon to strip, so no data is silently dropped.
function stripLabel(text) {
  return text.replace(/^[^:：]*[:：]\s*/, "").trim();
}

// Collapses every ASCII/full-width space out of a string — cb-pigeon.com's
// free-text column pads labels with full-width spaces for visual alignment
// (e.g. "會    長：", "秘 　書 ："), which would otherwise defeat a literal
// "會長"/"秘書" match.
function compact(text) {
  return text.replace(/[\s　]/g, "");
}

const PHONE_LIKE_RE = /^[\d０-９\-—–、,，.]+$/;

// Detail pages hold a group's info in two independently-populated places
// (confirmed across all ~104 real pages while building this script — see
// this function's tests for representative fixtures of each shape):
//
//   - A structured left column of `<div class="view-info-rows">`, each
//     icon-typed (fa-user/fa-phone/fa-map-marker/fa-globe/fa-fax). This is
//     the ONLY source for the majority of groups (their right column is a
//     single empty paragraph) but only ever has room for one name-shaped
//     field (labeled "會長" — never "秘書").
//   - A free-form right-column paragraph (line-per-<br>) that, when present,
//     often repeats the chairman and adds richer detail the left column has
//     no room for (secretary, address in some cases, the 即時返鴿查詢 link).
//     Its labels aren't fully consistent either — "會長"/"盧會長" (name
//     before the title), "地址"/"會址", plain "電話" vs "服務電話", and the
//     name+phone can be on the same line or split across two.
//
// Strategy: read the left column first (cleanest, most consistent source),
// then fill in whatever it left null from the right-column free text. Given
// how inconsistent the free text is, this is deliberately best-effort — a
// field this can't confidently parse is left null rather than guessed at,
// same as pigeon_shops/pigeon_stations' existing nullable-field precedent.
export function extractGroupFromHtml(html) {
  const $ = cheerio.load(html);
  const name = $(".view-info-top .header").first().text().trim();

  const leftRows = [];
  $(".view-info-box .half.l .view-info-rows").each((_, el) => {
    const icon = $(el).find(".icon i").attr("class") || "";
    const info = $(el).find(".info").first();
    const href = info.find("a.link").attr("href") || null;
    const text = info.text().replace(/\s+/g, " ").trim();
    leftRows.push({ icon, text, href });
  });

  const chairmanRow = leftRows.find((r) => r.icon.includes("fa-user") && /^會長/.test(compact(r.text)));
  const phoneRow = leftRows.find((r) => r.icon.includes("fa-phone"));
  const addressRow = leftRows.find((r) => r.icon.includes("fa-map-marker"));
  const websiteRow = leftRows.find((r) => r.icon.includes("fa-globe"));

  let address = addressRow ? stripLabel(addressRow.text) || null : null;
  let chairmanName = chairmanRow ? stripLabel(chairmanRow.text) || null : null;
  let chairmanPhone = phoneRow ? stripLabel(phoneRow.text) || null : null;
  const websiteUrl = websiteRow ? websiteRow.href || stripLabel(websiteRow.text) || null : null;
  let secretaryName = null;
  let secretaryPhone = null;
  let pigeonTrackingUrl = null;
  let mapEmbedSrc = $(".view-info-box .half.r .map iframe").attr("src") || null;

  const content = $(".view-info-box .half.r .content").first();
  content.find("br").replaceWith("\n");
  const lines = content
    .text()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const flat = compact(line);

    if (!address) {
      const m = flat.match(/^(?:地址|會址)[:：](.+)$/);
      if (m) address = m[1].trim() || null;
    }

    if (!chairmanName) {
      // "會長：NAME　(服務)?電話：PHONE" or "會長：NAME" alone.
      let m = flat.match(/^會長[:：](.+)$/);
      if (m) {
        const rest = m[1];
        const split = rest.match(/^(.+?)(?:服務)?電話[:：](.+)$/);
        if (split) {
          chairmanName = split[1] || null;
          if (!chairmanPhone) chairmanPhone = split[2] || null;
        } else {
          chairmanName = rest || null;
          // Name-only line — the phone sometimes follows on its own next
          // line instead (e.g. "會長：鄒易余" / "服務電話：0932-111-333").
          if (!chairmanPhone && i + 1 < lines.length) {
            const nextMatch = compact(lines[i + 1]).match(/^(?:服務)?電話[:：](.+)$/);
            if (nextMatch) chairmanPhone = nextMatch[1].trim() || null;
          }
        }
      } else {
        // "盧會長：0932-377-818" — surname/title before the label, value is
        // a bare phone number rather than another name.
        m = flat.match(/^(.{1,4})會長[:：](.+)$/);
        if (m && PHONE_LIKE_RE.test(m[2])) {
          chairmanName = `${m[1]}會長`;
          if (!chairmanPhone) chairmanPhone = m[2];
        }
      }
    }

    if (!secretaryName) {
      let m = flat.match(/^秘書[:：](.+)$/);
      if (m) {
        const rest = m[1];
        const split = rest.match(/^(.+?)(?:服務)?電話[:：](.+)$/);
        if (split) {
          secretaryName = split[1] || null;
          secretaryPhone = split[2] || null;
        } else {
          secretaryName = rest || null;
        }
      } else {
        m = flat.match(/^(.{1,4})秘書[:：](.+)$/);
        if (m && PHONE_LIKE_RE.test(m[2])) {
          secretaryName = `${m[1]}秘書`;
          secretaryPhone = m[2];
        }
      }
    }

    if (!pigeonTrackingUrl && /即時返鴿/.test(line)) {
      const urlMatch = line.match(/https?:\/\/\S+/);
      if (urlMatch) pigeonTrackingUrl = urlMatch[0];
    }
  }

  return {
    name,
    address,
    chairmanName,
    chairmanPhone,
    secretaryName,
    secretaryPhone,
    websiteUrl,
    pigeonTrackingUrl,
    mapEmbedSrc,
  };
}

// Nominatim's Taiwan coverage is street-level at best for most addresses —
// exact house numbers (門牌號) are rarely mapped. Retries at progressively
// coarser precision, peeling off trailing house-number/弄/巷/段 tokens one at
// a time, same approach as scripts/import-pigeon-shops.mjs's
// addressGeocodeCandidates (duplicated here rather than imported — the two
// scripts have no shared module today, matching the existing precedent of
// import-pigeon-shops.mjs and import-pigeon-stations.mjs each owning their
// own copy of this dance).
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

async function existingGroup(pool, name, address) {
  const [rows] = await pool.query(
    "SELECT id FROM pigeon_groups WHERE name = ? AND address <=> ? LIMIT 1",
    [name, address],
  );
  return rows.length > 0 ? rows[0].id : null;
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (will connect DB + write rows)" : "DRY RUN (no DB connection)"}`);
  console.log(
    "Note: coordinate resolution (Google Maps embed parse + Nominatim fallback) runs in both modes — only the DB connection and the writes are gated behind --apply.\n",
  );

  const allIds = [];
  const seenIds = new Set();
  for (const region of REGIONS) {
    const html = await fetchText(`${SITE_ORIGIN}/group/${region}`);
    const ids = discoverGroupIds(html);
    console.log(`region ${region}: ${ids.length} group(s)`);
    for (const id of ids) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      allIds.push(id);
    }
  }
  console.log(`\nTotal unique groups across all regions: ${allIds.length}\n`);

  const groups = [];
  let embedCount = 0;
  let nominatimCount = 0;
  let failedCount = 0;

  for (const id of allIds) {
    const sourceUrl = `${SITE_ORIGIN}/group/view/${id}`;
    const html = await fetchText(sourceUrl);
    const parsed = extractGroupFromHtml(html);

    let lat = null;
    let lng = null;
    let coordSource = "failed";

    const embedCoords = parseGoogleMapsEmbedCoordinates(parsed.mapEmbedSrc);
    if (embedCoords) {
      lat = embedCoords.lat;
      lng = embedCoords.lng;
      coordSource = "embed";
      embedCount++;
    } else if (parsed.address) {
      const geocoded = await geocode(parsed.address);
      if (geocoded) {
        lat = geocoded.lat;
        lng = geocoded.lng;
        coordSource = "nominatim";
        nominatimCount++;
      } else {
        failedCount++;
      }
    } else {
      failedCount++;
    }

    groups.push({ ...parsed, sourceUrl, lat, lng, coordSource });
    console.log(`${sourceUrl}: ${parsed.name || "(無名稱)"} [coords: ${coordSource}]`);
  }

  const missing = (predicate) => groups.filter(predicate).length;
  console.log(`\nTotal groups parsed: ${groups.length}`);
  console.log(`  missing chairman name: ${missing((g) => !g.chairmanName)}`);
  console.log(`  missing secretary name: ${missing((g) => !g.secretaryName)}`);
  console.log(`  missing website: ${missing((g) => !g.websiteUrl)}`);
  console.log(`  missing pigeon-tracking link: ${missing((g) => !g.pigeonTrackingUrl)}`);
  console.log(`  missing address: ${missing((g) => !g.address)}`);
  console.log(`\nCoordinate source: embed=${embedCount}, nominatim=${nominatimCount}, failed=${failedCount}`);

  if (!APPLY) {
    console.log("\n[dry run] Sample of parsed groups:");
    for (const group of groups.slice(0, 5)) {
      console.log(
        `  - ${group.name} | 會長:${group.chairmanName ?? "(無)"} | 秘書:${group.secretaryName ?? "(無)"} | ` +
          `地址:${group.address ?? "(無)"} | (${group.lat ?? "no lat"}, ${group.lng ?? "no lng"})`,
      );
    }
    console.log("\nRe-run with --apply to write rows into pigeon_groups.");
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

  try {
    for (const group of groups) {
      if (!group.name) {
        console.warn(`skip (no name parsed): ${group.sourceUrl}`);
        continue;
      }

      const dupId = await existingGroup(pool, group.name, group.address);
      if (dupId) {
        skippedExisting++;
        console.log(`skip (already imported as #${dupId}): ${group.name}`);
        continue;
      }

      await pool.query(
        `INSERT INTO pigeon_groups
           (name, address, lat, lng, chairman_name, chairman_phone, secretary_name, secretary_phone,
            website_url, pigeon_tracking_url, source_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          group.name,
          group.address,
          group.lat,
          group.lng,
          group.chairmanName,
          group.chairmanPhone,
          group.secretaryName,
          group.secretaryPhone,
          group.websiteUrl,
          group.pigeonTrackingUrl,
          group.sourceUrl,
        ],
      );
      inserted++;
      console.log(`inserted: ${group.name}`);
    }
  } finally {
    await pool.end();
  }

  console.log(`\nDone. ${inserted} row(s) inserted, ${skippedExisting} skipped (already present).`);
}

// Guarded so importing this module's pure helpers (discoverGroupIds,
// parseGoogleMapsEmbedCoordinates, extractGroupFromHtml,
// addressGeocodeCandidates) from a test file doesn't also trigger a live
// network crawl as a side effect of the import.
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
