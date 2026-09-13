// issue #261: a manual "立即手動同步" run (news) can run long enough
// (many external requests, plus a Cloudflare Workers AI translation call per
// paragraph for herbots.be content) to exceed the production reverse proxy's
// own timeout — which then returns an HTML/plain-text error page instead of
// JSON. Calling `response.json()` directly on that turns into an opaque
// `Unexpected token '<' ... is not valid JSON` exception surfacing straight
// to the admin. Used by HerbotsNewsSyncButton.tsx
// (heavy enough to realistically hit this) to check `response.ok`/content-type
// before ever calling `.json()`.
export interface ParsedSyncResponse<T> {
  ok: boolean;
  /** Present when ok is false — a clear, user-facing zh-TW message. */
  message?: string;
  /** Present when ok is true — the parsed JSON body. */
  data?: T;
}

const NON_JSON_MESSAGE = "同步逾時或伺服器發生錯誤，請稍後查看伺服器 log 確認同步是否實際完成。";

export async function parseSyncApiResponse<T>(response: Response): Promise<ParsedSyncResponse<T>> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("application/json")) {
    return { ok: false, message: `${NON_JSON_MESSAGE}（HTTP ${response.status}）` };
  }

  try {
    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch {
    // content-type claimed JSON but the body wasn't actually parseable —
    // treat the same as the non-JSON case above rather than letting
    // response.json()'s exception escape to the caller.
    return { ok: false, message: NON_JSON_MESSAGE };
  }
}
