/** Next.js 的 searchParams 形狀：同名參數出現多次時會是陣列。 */
export type SearchParams = Record<string, string | string[] | undefined>;

/** 同名參數出現多次時只取第一個（六個後台列表頁原本各自抄一份 first()）。 */
export function parseFirstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** page 參數：非數字、0、負數一律當作第 1 頁。 */
export function parsePageParam(value: string | string[] | undefined): number {
  return Math.max(1, Number(parseFirstParam(value) ?? "1") || 1);
}

/**
 * 依 keys 的順序把目前的查詢參數重組成 query string，overrides 內的值優先；
 * 空字串會被略過（匯出 CSV 的連結就是靠這點把 page 從網址移掉）。
 */
export function buildQueryString(
  params: SearchParams,
  keys: readonly string[],
  overrides: Record<string, string> = {},
): string {
  const query = new URLSearchParams();
  for (const key of keys) {
    const value = key in overrides ? overrides[key] : parseFirstParam(params[key]);
    if (value) query.set(key, value);
  }
  return query.toString();
}
