// Pure search logic for issue #105's Chinese-aware search — no DB involved,
// so directly unit-testable (see search.test.ts). tokenizeSearchQuery turns
// a raw search string into meaningful keywords; buildKeywordSearch turns
// those keywords into the `LIKE` conditions/params a list query needs. The
// three admin list queries in lib/listings.ts had each re-typed that second
// step (issue #139), so it lives here now rather than three times over
// there.
//
// Previously each search site did a single `title LIKE '%whole query%'`,
// which fails for multi-word queries with spaces (e.g. "石君 回血") since
// the space is part of the literal substring being matched. Segmenting with
// jieba first lets each word be matched independently.

import { Jieba } from "@node-rs/jieba";
import { dict } from "@node-rs/jieba/dict";

// Loading the dictionary has real cost (~5MB parsed once), so the segmenter
// is created lazily and reused for the lifetime of the process rather than
// per call.
let jieba: Jieba | null = null;
function getJieba(): Jieba {
  if (!jieba) {
    jieba = Jieba.withDict(dict);
  }
  return jieba;
}

// Whitespace and punctuation/symbol-only tokens (ASCII or full-width CJK,
// e.g. "，" "！" or a lone space jieba splits out between words) carry no
// search meaning — matching on them via LIKE would effectively match
// everything, so they're dropped rather than treated as keywords.
const PUNCTUATION_OR_WHITESPACE_ONLY = /^[\s\p{P}\p{S}]+$/u;

// Segments a raw search query into a deduplicated list of meaningful
// keywords, using jieba for Chinese-aware word segmentation. Returns an
// empty array if the query is empty/whitespace-only or segments to nothing
// but punctuation — callers should treat that as "no usable tokens" and
// fall back to their own previous whole-string behavior (see lib/listings.ts)
// rather than silently dropping the search filter.
export function tokenizeSearchQuery(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const segments = getJieba().cut(trimmed, true);
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const segment of segments) {
    const token = segment.trim();
    if (!token) continue;
    if (PUNCTUATION_OR_WHITESPACE_ONLY.test(token)) continue;
    if (seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

export interface KeywordSearchSql {
  /** One AND-able condition per keyword; empty when there's nothing to search for. */
  conditions: string[];
  /** Bind params for `conditions`, in the same order. */
  params: string[];
  /**
   * Prefix for the caller's own ORDER BY (already comma-terminated), ranking
   * rows that match the *whole* original query above ones that only matched
   * via individual keyword segments. Empty string when there's no search, so
   * callers can always write `${rankPrefix}${orderBy}` unconditionally.
   */
  rankPrefix: string;
  /** Bind params for `rankPrefix`, appended after every WHERE param. */
  rankParams: string[];
}

const EMPTY_KEYWORD_SEARCH: KeywordSearchSql = { conditions: [], params: [], rankPrefix: "", rankParams: [] };

/**
 * Turns a raw search box value into the SQL a paginated admin list query
 * needs: one `(col LIKE ? OR col LIKE ?)` condition per segmented keyword,
 * AND'd together, plus an ORDER BY prefix that floats whole-query matches to
 * the top.
 *
 * Falls back to matching the whole trimmed string when segmentation yields
 * no usable tokens (e.g. an all-punctuation query), so the filter is never
 * silently dropped and the caller returns everything.
 *
 * `columns` and `rankColumn` are interpolated into SQL directly, so they must
 * be module-level column names — never caller input. Only the search text
 * itself becomes a bind param.
 */
export function buildKeywordSearch(
  search: string | undefined,
  options: { columns: readonly string[]; rankColumn: string },
): KeywordSearchSql {
  const trimmed = search?.trim();
  if (!trimmed) return EMPTY_KEYWORD_SEARCH;

  const tokens = tokenizeSearchQuery(trimmed);
  const searchTerms = tokens.length > 0 ? tokens : [trimmed];

  const conditions: string[] = [];
  const params: string[] = [];
  const matchesAnyColumn = `(${options.columns.map((column) => `${column} LIKE ?`).join(" OR ")})`;
  for (const term of searchTerms) {
    conditions.push(matchesAnyColumn);
    // One bind param per column, since each column gets its own `LIKE ?`.
    params.push(...options.columns.map(() => `%${term}%`));
  }

  return {
    conditions,
    params,
    rankPrefix: `CASE WHEN ${options.rankColumn} LIKE ? THEN 0 ELSE 1 END, `,
    rankParams: [`%${trimmed}%`],
  };
}
