// Address -> 縣市 (county/city) classifier shared by the pigeon-shops and
// pigeon-stations directory pages (issue #256). Both tables' `address`
// column is free-text, scraped from nicepigeon.com (see
// scripts/import-pigeon-shops.mjs / scripts/import-pigeon-stations.mjs) —
// the leading text is sometimes a postal code + district/city name,
// sometimes the county/city name directly, and every 台/臺 variant of the
// four counties that have one shows up somewhere in the real data.
//
// Deliberately NOT anchored to the very start of the string: postal codes
// (3-6 digits, occasionally "800-51"-style) and stray "台灣"/"臺灣" prefixes
// precede the county name often enough that stripping every possible prefix
// shape would be more fragile than just searching a short leading window.
// Deliberately does NOT attempt to infer a county from a bare district name
// (e.g. "三重區" with no "新北市" prefix, "屏東市" with no "屏東縣" prefix) —
// that would need an exhaustive district->county table (368 entries) covering
// every township in Taiwan; scripts/import-pigeon-stations.mjs's
// DISTRICT_TO_CITY table only covers the handful of districts that appear in
// its own ~30-row source page, which isn't broad enough to reuse here. Per
// issue #256's spec, an address that can't be classified is not an error —
// it just returns null and the caller buckets it as "unclassified", which
// stays visible under the "all counties" filter state.

/** All 22 of Taiwan's counties/cities, in the conventional geographic
 * grouping (6 直轄市, then 3 省轄市, then 13 縣) — also the order county
 * filter dropdowns list them in, rather than lexicographic order. */
export const TAIWAN_COUNTY_ORDER = [
  "台北市",
  "新北市",
  "桃園市",
  "台中市",
  "台南市",
  "高雄市",
  "基隆市",
  "新竹市",
  "嘉義市",
  "新竹縣",
  "苗栗縣",
  "彰化縣",
  "南投縣",
  "雲林縣",
  "嘉義縣",
  "屏東縣",
  "宜蘭縣",
  "花蓮縣",
  "台東縣",
  "澎湖縣",
  "金門縣",
  "連江縣",
] as const;

export type TaiwanCounty = (typeof TAIWAN_COUNTY_ORDER)[number];

// Canonical output always uses the 台 spelling (matching
// scripts/import-pigeon-stations.mjs's KNOWN_CITY_COUNTY list and this
// project's own everyday usage — see messages/*.json), but the pattern
// matches either 台 or 臺 in the source address, since both appear in real
// scraped data.
const COUNTY_PATTERNS: ReadonlyArray<{ name: TaiwanCounty; pattern: RegExp }> = [
  { name: "台北市", pattern: /[台臺]北市/ },
  { name: "新北市", pattern: /新北市/ },
  { name: "桃園市", pattern: /桃園市/ },
  { name: "台中市", pattern: /[台臺]中市/ },
  { name: "台南市", pattern: /[台臺]南市/ },
  { name: "高雄市", pattern: /高雄市/ },
  { name: "基隆市", pattern: /基隆市/ },
  { name: "新竹市", pattern: /新竹市/ },
  { name: "嘉義市", pattern: /嘉義市/ },
  { name: "新竹縣", pattern: /新竹縣/ },
  { name: "苗栗縣", pattern: /苗栗縣/ },
  { name: "彰化縣", pattern: /彰化縣/ },
  { name: "南投縣", pattern: /南投縣/ },
  { name: "雲林縣", pattern: /雲林縣/ },
  { name: "嘉義縣", pattern: /嘉義縣/ },
  { name: "屏東縣", pattern: /屏東縣/ },
  { name: "宜蘭縣", pattern: /宜蘭縣/ },
  { name: "花蓮縣", pattern: /花蓮縣/ },
  { name: "台東縣", pattern: /[台臺]東縣/ },
  { name: "澎湖縣", pattern: /澎湖縣/ },
  { name: "金門縣", pattern: /金門縣/ },
  { name: "連江縣", pattern: /連江縣/ },
];

// Wide enough to cover the longest realistic prefix ("台灣" + a 6-digit
// extended postal code + a separator) plus the county name itself, without
// being so wide that it risks matching a county-name-shaped substring deep
// inside a street name.
const LEADING_WINDOW = 20;

/**
 * Extracts the 縣市 (county/city) an address belongs to, or null if none of
 * Taiwan's 22 counties/cities can be found near the start of the string.
 * Never throws — every input, including null/empty/garbage, is a valid
 * argument.
 */
export function parseCountyFromAddress(address: string | null | undefined): TaiwanCounty | null {
  if (!address) return null;
  const window = address.trim().slice(0, LEADING_WINDOW);
  if (!window) return null;

  for (const { name, pattern } of COUNTY_PATTERNS) {
    if (pattern.test(window)) return name;
  }
  return null;
}
