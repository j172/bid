// Search + 縣市 filtering shared by the pigeon-shops and pigeon-stations
// directory explorer components (issue #256). Both pages have the same
// shape of requirement — a client-side search box over name/address plus a
// county dropdown, combined with AND logic, driving both the list and which
// map markers show — so the pure filtering logic lives here once instead of
// being written twice against near-identical PigeonShopListItem /
// PigeonStationListItem types.

import { parseCountyFromAddress, TAIWAN_COUNTY_ORDER, type TaiwanCounty } from "@/lib/taiwanCounty";

/** Sentinel `county` value meaning "no county filter applied" — used as the
 * county <select>'s "all counties" option value by both explorer components. */
export const ALL_COUNTIES_VALUE = "all";

export interface PigeonDirectoryEntry {
  name: string;
  address: string | null;
}

export interface PigeonDirectoryFilterCriteria {
  /** Case-insensitive substring match over name + address; blank/absent means no search. */
  searchQuery?: string;
  /** A TaiwanCounty to restrict to, or ALL_COUNTIES_VALUE/absent for no county filter. */
  county?: string;
}

/**
 * Applies the search text and county filter together (AND logic). Entries
 * whose address can't be classified into a county (see
 * lib/taiwanCounty.ts's parseCountyFromAddress) are excluded whenever a
 * specific county is selected — they only show up in the unfiltered "all
 * counties" state, per issue #256's spec.
 */
export function filterPigeonDirectoryEntries<T extends PigeonDirectoryEntry>(
  entries: readonly T[],
  criteria: PigeonDirectoryFilterCriteria,
): T[] {
  const needle = criteria.searchQuery?.trim().toLowerCase() ?? "";
  const county = criteria.county && criteria.county !== ALL_COUNTIES_VALUE ? criteria.county : null;

  return entries.filter((entry) => {
    if (needle.length > 0) {
      const haystack = `${entry.name} ${entry.address ?? ""}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    if (county !== null && parseCountyFromAddress(entry.address) !== county) return false;

    return true;
  });
}

/**
 * Which counties actually occur in `entries`, in TAIWAN_COUNTY_ORDER's
 * geographic order — the county <select> must only list options that have
 * at least one matching row (issue #256's spec), never every county in
 * Taiwan regardless of the data.
 */
export function listPresentCounties<T extends PigeonDirectoryEntry>(entries: readonly T[]): TaiwanCounty[] {
  const present = new Set<TaiwanCounty>();
  for (const entry of entries) {
    const county = parseCountyFromAddress(entry.address);
    if (county) present.add(county);
  }
  return TAIWAN_COUNTY_ORDER.filter((county) => present.has(county));
}
