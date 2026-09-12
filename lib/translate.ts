// Cloudflare Workers AI translation client (issue #240) — shared by the
// herbots.be news sync (lib/newsSync.ts) and, per the parent Epic (#239),
// meant to be reused as-is by the future loing-ma.com/herbots.be race sync
// (#241) once #240's infrastructure lands. Deliberately generic ("translate
// this plain text to Traditional Chinese") rather than news-specific.
//
// Requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_TOKEN (see
// .env.example) — a brand-new Cloudflare credential pair, separate from this
// project's existing CLOUDFLARE_TURNSTILE_* keys (those only ever verify
// anti-abuse tokens, they can't call Workers AI). Neither is set in most
// dev/CI environments yet, so every export here is written to degrade
// gracefully (log once, return a typed failure) rather than throw — a
// missing/invalid credential must never crash the whole sync job (issue
// #240's explicit requirement), it should just mean this run's articles get
// no translation and that fact is visible in server logs.
import { httpsRequest } from "@/lib/httpsRequest";

// m2m100-1.2b is Workers AI's general-purpose translation model — small
// enough for near-real-time per-paragraph calls, and (per Cloudflare's own
// docs) one of the few translation models whose target_lang list includes
// "chinese_traditional" as a distinct option from simplified "chinese",
// which is exactly the distinction this project's zh-TW-only content needs.
const TRANSLATE_MODEL = "@cf/meta/m2m100-1.2b";
const SOURCE_LANG = "english";
const TARGET_LANG = "chinese_traditional";

export function isTranslationConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_AI_API_TOKEN);
}

export type TranslateResult = { ok: true; text: string } | { ok: false; error: string };

interface WorkersAiTranslateResponse {
  success: boolean;
  errors?: { message: string }[];
  result?: { translated_text?: string };
}

// Translates one plain-text string. Callers that have HTML (lib/newsSync.ts)
// are responsible for stripping tags before calling this and re-wrapping the
// result afterwards — Workers AI's translation models operate on plain text,
// they don't understand or preserve markup.
//
// Empty/whitespace-only input short-circuits to an empty success without a
// network call — a blank paragraph has nothing to translate, and the API
// otherwise rejects an empty `text` field as a 400.
export async function translateToTraditionalChinese(text: string): Promise<TranslateResult> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { ok: true, text: "" };
  }

  if (!isTranslationConfigured()) {
    const error = "Cloudflare Workers AI 未設定（缺少 CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_AI_API_TOKEN），略過翻譯";
    console.error(`[translate] ${error}`);
    return { ok: false, error };
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_AI_API_TOKEN;
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${TRANSLATE_MODEL}`;

  try {
    const { status, body } = await httpsRequest(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: trimmed, source_lang: SOURCE_LANG, target_lang: TARGET_LANG }),
    });

    if (status < 200 || status >= 300) {
      const error = `Cloudflare Workers AI 回應 HTTP ${status}`;
      console.error(`[translate] ${error}: ${body.slice(0, 500)}`);
      return { ok: false, error };
    }

    const parsed: WorkersAiTranslateResponse = JSON.parse(body);
    const translated = parsed.result?.translated_text;
    if (!parsed.success || typeof translated !== "string") {
      const error = parsed.errors?.map((e) => e.message).join("; ") || "Cloudflare Workers AI 未回傳翻譯結果";
      console.error(`[translate] ${error}`);
      return { ok: false, error };
    }

    return { ok: true, text: translated };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error(`[translate] Cloudflare Workers AI 呼叫失敗: ${message}`, cause);
    return { ok: false, error: message };
  }
}
