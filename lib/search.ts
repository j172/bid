// Pure query-tokenization logic for issue #105's Chinese-aware search — no
// DB involved, so directly unit-testable (see search.test.ts). Callers in
// lib/listings.ts turn these tokens into `LIKE` conditions themselves; this
// module only knows how to turn a raw search string into meaningful
// keywords.
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
