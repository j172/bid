import { SITE_URL } from "@/lib/siteUrl";

export const DEFAULT_INDEXNOW_KEY = "e3b0c44298fc1c149afbf4c8996fb924";

export function getIndexNowKey(): string {
  return process.env.INDEXNOW_KEY?.trim() || DEFAULT_INDEXNOW_KEY;
}

export function getIndexNowKeyLocation(siteUrl = SITE_URL): string {
  const key = getIndexNowKey();
  return `${siteUrl.replace(/\/+$/, "")}/${key}.txt`;
}

export interface IndexNowSubmitResult {
  ok: boolean;
  count: number;
  status?: number;
  error?: string;
}

/**
 * Submits a list of absolute URLs to the IndexNow protocol endpoint (api.indexnow.org).
 * Supported by Microsoft Bing, Yandex, Naver, and Seznam.
 * Guaranteed not to throw: returns ok: false with error details on failure.
 */
export async function submitToIndexNow(urls: string[]): Promise<IndexNowSubmitResult> {
  const filtered = Array.from(new Set(urls.filter((u) => typeof u === "string" && u.startsWith("http"))));
  if (filtered.length === 0) {
    return { ok: true, count: 0 };
  }

  const key = getIndexNowKey();
  let host = "xiangshuicn.cc";
  try {
    const parsed = new URL(filtered[0]);
    host = parsed.hostname;
  } catch {
    // Fallback to parsed SITE_URL
    try {
      host = new URL(SITE_URL).hostname;
    } catch {
      // Keep default host
    }
  }

  const keyLocation = getIndexNowKeyLocation(`https://${host}`);

  const payload = {
    host,
    key,
    keyLocation,
    urlList: filtered,
  };

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
      // 8s timeout to avoid hanging long background requests
      signal: AbortSignal.timeout(8000),
    });

    // IndexNow specs: 200 = OK, 202 = Accepted (URLs received, will be processed)
    if (res.status === 200 || res.status === 202) {
      return { ok: true, count: filtered.length, status: res.status };
    }

    const responseText = await res.text().catch(() => "");
    return {
      ok: false,
      count: 0,
      status: res.status,
      error: `IndexNow returned status ${res.status}: ${responseText.slice(0, 200)}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      count: 0,
      error: `Failed to submit to IndexNow: ${message}`,
    };
  }
}
