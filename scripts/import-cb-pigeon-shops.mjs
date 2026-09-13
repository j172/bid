// One-time import: crawls cb-pigeon.com (凱克博賽鴿資訊網)'s 商家查詢 (store)
// directory — three region nav pages (/store/n, /store/w, /store/s), each
// linking to a handful of category pages (/store/{region}/{catId}, ids not
// hardcoded — discovered from the nav page since they can change), each
// listing shops that link to a /store/view/{id} detail page — and writes the
// result into the `pigeon_shops` table (see db/init.sql), same table the
// nicepigeon.com import (scripts/import-pigeon-shops.mjs, issue #243) seeded.
//
// Issue #259 (part of Epic #239). Modeled directly on
// scripts/import-pigeon-shops.mjs: defaults to a dry run (crawl + parse +
// report only) and only geocodes/writes with --apply. Reuses that script's
// `addressGeocodeCandidates`/`nominatimSearch` Nominatim fallback (same 1
// req/s rate limit) — see geocode() below — but this source additionally
// embeds a Google Maps iframe on every detail page, whose `src` query string
// carries the shop's real coordinates (`ll=<lat>,<lng>`, confirmed against a
// human-verified page: /store/view/10 → ll=25.077242,121.524067, matching
// 台北市士林區文林路524號); that embedded coordinate is tried first, and
// Nominatim is only a fallback for the — considerably rarer here than on
// nicepigeon.com — shop with no map at all (e.g. one with no address).
//
// Usage:
//   node scripts/import-cb-pigeon-shops.mjs            # dry run: crawl + parse + report only
//   node scripts/import-cb-pigeon-shops.mjs --apply     # write rows to pigeon_shops
//
// Dedup against ALL existing pigeon_shops rows regardless of source:
//   1. Exact `name = ? AND address <=> ?` match (same rule
//      scripts/import-pigeon-shops.mjs uses) → skip, don't write.
//   2. Phone match after normalizing away whitespace/dashes/fullwidth chars
//      (see normalizePhoneForComparison) where name/address differ →
//      NOT auto-skipped (could be two branches of the same shop, or a
//      shared landline) — still written as a new row, but printed to a
//      "疑似重複，待人工複查" list so a human can decide whether to merge or
//      delete one of them by hand afterward via the admin CRUD page.
//
// Deliberately NOT wired into lib/scheduler.ts's daily cron, same as #243 —
// one-time run by hand, then maintained through app/z04urru6/pigeon-shops.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as cheerio from "cheerio";
import mysql from "mysql2/promise";
import { addressGeocodeCandidates, nominatimSearch } from "./import-pigeon-shops.mjs";

// Minimal .env loader — see migrate-description-html.mjs / import-pigeon-shops.mjs
// for the fuller header comment on why this is needed (this script runs
// standalone via `node`, outside Next.js's own env loading).
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
  "bid-cb-pigeon-shops-import/1.0 (one-time crawl for https://github.com/j172/bid issue #259; contact: j1720728@gmail.com)";
const NOMINATIM_USER_AGENT =
  "bid-cb-pigeon-shops-import/1.0 (+https://github.com/j172/bid issue #259; contact: j1720728@gmail.com)";

async function fetchText(url) {
  const response = await fetch(url, { headers: { "User-Agent": CRAWL_USER_AGENT } });
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

// Parses a region nav page (e.g. /store/n) for its category links
// (/store/{region}/{catId}). The set of categories/ids is not hardcoded
// anywhere — n currently has 3, w has 10, s has 6, but that's read from the
// page, not assumed.
export function discoverCategoryLinksFromNavHtml(html, region) {
  const $ = cheerio.load(html);
  const linkRe = new RegExp(`^/store/${region}/(\\d+)$`);
  const seen = new Map();
  $(`a[href^="/store/${region}/"]`).each((_, el) => {
    const href = $(el).attr("href");
    const match = href && href.match(linkRe);
    if (!match) return;
    const id = match[1];
    if (seen.has(id)) return;
    seen.set(id, { id, region, label: $(el).text().trim(), url: `${SITE_ORIGIN}${href}` });
  });
  return [...seen.values()];
}

// Parses a category page (e.g. /store/n/3) for the shop ids it lists —
// each shop is a `<a class="block-3-columns" href="/store/view/{id}">`
// inside a single `.columns-box` container, but this doesn't rely on that
// wrapper (just the href shape) since it's simpler and just as unambiguous.
export function extractShopIdsFromCategoryHtml(html) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const ids = [];
  $('a[href^="/store/view/"]').each((_, el) => {
    const href = $(el).attr("href");
    const match = href && href.match(/^\/store\/view\/(\d+)$/);
    if (!match) return;
    const id = Number(match[1]);
    if (seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  });
  return ids;
}

// A detail page's embedded Google Maps iframe src carries the shop's
// coordinates as one of several near-duplicate query params — `ll` (plain
// map center), `sll`/`cbll` (Street View camera position) — all populated
// from the same geocoded address, so any one of them is usable, but `ll` is
// consistently present and is the plain "map center" the human-verified
// /store/view/10 fixture confirms lines up with the shop's real address
// (ll=25.077242,121.524067 for 台北市士林區文林路524號). Tried first;
// sll/cbll are only there as a fallback for the rare page missing `ll` but
// still carrying a Street View position.
const IFRAME_COORD_PARAMS = ["ll", "sll", "cbll"];

export function parseGoogleMapsIframeCoords(iframeSrc) {
  if (!iframeSrc) return null;
  let url;
  try {
    url = new URL(iframeSrc, SITE_ORIGIN);
  } catch {
    return null;
  }

  for (const param of IFRAME_COORD_PARAMS) {
    const raw = url.searchParams.get(param);
    if (!raw) continue;
    const match = raw.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    return { lat, lng };
  }
  return null;
}

// A detail page's shop info lives in `.view-info-top` (category "subtitle" +
// shop "header" title) and a run of `.view-info-rows` blocks, each an icon +
// a `p.info` line — 聯絡人 (fa-user), 電話 (fa-phone), 地址 (fa-map-marker) —
// identified by icon class rather than line order/prefix text since a few
// live pages have a garbled 地址 line (e.g. /store/view/24, whose address
// line is itself a duplicated phone number — a source data-quality issue,
// not a parsing bug; passed through verbatim like nicepigeon's own
// occasional missing-field rows). Returns null when the page doesn't look
// like a shop detail page at all (missing `.view-info-top`).
export function extractShopFromDetailHtml(html) {
  const $ = cheerio.load(html);
  const top = $(".view-info-top").first();
  if (top.length === 0) return null;

  const name = top.find(".header").first().text().trim();
  if (!name) return null;
  const category = top.find(".subtitle").first().text().trim() || null;

  let contact = null;
  let phone = null;
  let address = null;

  $(".view-info-rows").each((_, row) => {
    const $row = $(row);
    const info = $row.find("p.info").first();
    if (info.length === 0) return;
    const text = info.text().replace(/\s+/g, " ").trim();
    if (!text) return;

    if ($row.find(".fa-user").length > 0) {
      contact = text.replace(/^聯絡人\s*[:：]?\s*/, "").trim() || null;
    } else if ($row.find(".fa-phone").length > 0) {
      phone = text.replace(/^電話\s*[:：]?\s*/, "").trim() || null;
    } else if ($row.find(".fa-map-marker").length > 0) {
      address = text.replace(/^地址\s*[:：]?\s*/, "").trim() || null;
    }
  });

  const iframeSrc = $(".view-info-box .map iframe").first().attr("src") ?? null;
  const mapCoords = parseGoogleMapsIframeCoords(iframeSrc);

  return { category, name, contact, phone, address, mapCoords };
}

// Normalizes a phone number for equality comparison only (never stored) —
// strips whitespace (incl. the fullwidth U+3000 space \s already matches),
// dashes, and parens, and folds fullwidth ASCII (digits, dashes, parens,
// etc. — the U+FF01–FF5E block) down to halfwidth first so "０２－２８３１"
// and "02-2831" normalize identically.
const FULLWIDTH_ASCII_OFFSET = 0xfee0;

export function normalizePhoneForComparison(phone) {
  if (!phone) return "";
  return phone
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - FULLWIDTH_ASCII_OFFSET))
    .replace(/[\s\-()]/g, "");
}

/** True when both phone numbers normalize to the same non-empty string. */
export function phonesMatch(a, b) {
  const normalizedA = normalizePhoneForComparison(a);
  const normalizedB = normalizePhoneForComparison(b);
  return normalizedA.length > 0 && normalizedA === normalizedB;
}

async function geocode(address) {
  for (const candidate of addressGeocodeCandidates(address)) {
    const result = await nominatimSearch(candidate, NOMINATIM_USER_AGENT);
    if (result) {
      if (candidate !== address) {
        console.log(`  geocoded via fallback "${candidate}" (from "${address}")`);
      }
      return result;
    }
  }
  return null;
}

async function discoverAllShopIds() {
  const categories = [];
  for (const region of REGIONS) {
    const html = await fetchText(`${SITE_ORIGIN}/store/${region}`);
    const found = discoverCategoryLinksFromNavHtml(html, region);
    console.log(`region ${region}: ${found.length} categor${found.length === 1 ? "y" : "ies"} (${found.map((c) => c.label).join("、")})`);
    categories.push(...found);
  }
  console.log(`\nFound ${categories.length} categor${categories.length === 1 ? "y" : "ies"} across ${REGIONS.length} regions.\n`);

  const shopEntries = new Map(); // id -> { id, sourceUrl, category }
  for (const category of categories) {
    const html = await fetchText(category.url);
    const ids = extractShopIdsFromCategoryHtml(html);
    console.log(`${category.label} (${category.url}): ${ids.length} shop(s)`);
    for (const id of ids) {
      if (shopEntries.has(id)) continue;
      shopEntries.set(id, { id, sourceUrl: `${SITE_ORIGIN}/store/view/${id}` });
    }
  }

  return [...shopEntries.values()];
}

async function existingShop(pool, name, address) {
  const [rows] = await pool.query("SELECT id FROM pigeon_shops WHERE name = ? AND address <=> ? LIMIT 1", [
    name,
    address,
  ]);
  return rows.length > 0 ? rows[0].id : null;
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (will write to DB)" : "DRY RUN (parse + report only, no DB connection)"}`);
  console.log(`Discovering categories + shops from ${SITE_ORIGIN} ...\n`);

  const shopRefs = await discoverAllShopIds();
  console.log(`\nTotal shop detail pages to visit: ${shopRefs.length}\n`);

  const shops = [];
  let coordFromMap = 0;
  let coordFromNominatim = 0;
  let coordMissing = 0;

  for (const ref of shopRefs) {
    let html;
    try {
      html = await fetchText(ref.sourceUrl);
    } catch (error) {
      console.warn(`skip ${ref.sourceUrl}: ${error.message}`);
      continue;
    }

    const parsed = extractShopFromDetailHtml(html);
    if (!parsed) {
      console.warn(`skip ${ref.sourceUrl}: doesn't look like a shop detail page`);
      continue;
    }

    let lat = null;
    let lng = null;
    if (parsed.mapCoords) {
      ({ lat, lng } = parsed.mapCoords);
      coordFromMap++;
    } else if (parsed.address) {
      const coords = await geocode(parsed.address);
      if (coords) {
        ({ lat, lng } = coords);
        coordFromNominatim++;
      } else {
        coordMissing++;
      }
    } else {
      coordMissing++;
    }

    shops.push({ ...parsed, ...ref, lat, lng });
  }

  console.log(`\nTotal shops parsed: ${shops.length}`);
  const missingPhone = shops.filter((s) => !s.phone).length;
  const missingAddress = shops.filter((s) => !s.address).length;
  console.log(`  missing phone: ${missingPhone}`);
  console.log(`  missing address: ${missingAddress}`);
  console.log(`  coordinates from embedded map: ${coordFromMap}`);
  console.log(`  coordinates from Nominatim fallback: ${coordFromNominatim}`);
  console.log(`  coordinates missing (both failed): ${coordMissing}`);

  if (!APPLY) {
    console.log("\n[dry run] Sample of parsed shops:");
    for (const shop of shops.slice(0, 10)) {
      console.log(
        `  - ${shop.name} | ${shop.category ?? "(無分類)"} | ${shop.phone ?? "(無電話)"} | ${shop.address ?? "(無地址)"} | ` +
          `${shop.lat !== null ? `${shop.lat}, ${shop.lng}` : "(無座標)"}`,
      );
    }
    console.log("\nRe-run with --apply to write rows into pigeon_shops.");
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
  const suspectedDuplicates = [];

  try {
    // Load every existing row's phone once — this crawl is a few hundred
    // shops at most, so comparing in JS against a single upfront SELECT is
    // simpler and far fewer round-trips than a per-shop query, and the
    // comparison itself is the pure, unit-tested normalizePhoneForComparison.
    const [existingRows] = await pool.query(
      "SELECT id, name, address, phone FROM pigeon_shops WHERE phone IS NOT NULL",
    );

    for (const shop of shops) {
      const dupId = await existingShop(pool, shop.name, shop.address);
      if (dupId) {
        skippedExisting++;
        console.log(`skip (already imported as #${dupId}): ${shop.name}`);
        continue;
      }

      const phoneMatches = shop.phone
        ? existingRows.filter((row) => phonesMatch(row.phone, shop.phone))
        : [];
      if (phoneMatches.length > 0) {
        for (const match of phoneMatches) {
          suspectedDuplicates.push({ newShop: shop.name, existingId: match.id, existingName: match.name });
        }
      }

      await pool.query(
        `INSERT INTO pigeon_shops (name, phone, address, lat, lng, category, source_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [shop.name, shop.phone, shop.address, shop.lat, shop.lng, shop.category, shop.sourceUrl],
      );
      inserted++;
      console.log(`inserted: ${shop.name} (${shop.lat ?? "no lat"}, ${shop.lng ?? "no lng"})`);
    }
  } finally {
    await pool.end();
  }

  console.log(`\nDone. ${inserted} row(s) inserted, ${skippedExisting} skipped (already present).`);

  if (suspectedDuplicates.length > 0) {
    console.log(`\n疑似重複，待人工複查 (${suspectedDuplicates.length}):`);
    for (const dup of suspectedDuplicates) {
      console.log(`  - "${dup.newShop}" (newly inserted) shares a phone number with existing #${dup.existingId} "${dup.existingName}"`);
    }
    console.log("Review these by hand in app/z04urru6/pigeon-shops and delete/merge as appropriate.");
  }
}

// Guarded so importing this module's pure helpers from a test file doesn't
// also trigger a live network crawl as a side effect of the import (same
// pattern as scripts/import-pigeon-shops.mjs).
const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
